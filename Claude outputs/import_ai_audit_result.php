<?php
/**
 * Reads one PROMPT+RESPONSE cache pair and fills ai_audit_results.
 * Adjust the PDO connection details for your app.
 *
 * Usage: php import_ai_audit_result.php <prompt_json_path> <response_json_path>
 */

[, $promptPath, $responsePath] = $argv;

$pdo = new PDO('mysql:host=localhost;dbname=retention_lab;charset=utf8mb4', 'root', '');
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

$prompt   = json_decode(file_get_contents($promptPath), true);
$response = json_decode(file_get_contents($responsePath), true);

$meetingId = $prompt['meeting_id'];
$sessionId = $prompt['session_id'];

if (($response['status'] ?? null) !== 'OK') {
    fwrite(STDERR, "Response status not OK, skipping: {$responsePath}\n");
    exit(1);
}

// Strip a ```json ... ``` fence if present, then decode.
$raw = trim($response['raw_response']);
if (preg_match('/```json\s*(.*?)\s*```/s', $raw, $m)) {
    $raw = $m[1];
}
$parsed = json_decode($raw, true);
if ($parsed === null) {
    fwrite(STDERR, "Could not parse raw_response JSON for meeting {$meetingId} session {$sessionId}\n");
    exit(1);
}
$scores = $parsed['scores'] ?? [];

// Authoritative indicator lookup — never trust is_gate/category from the model.
$indicatorMap = [];
foreach ($pdo->query("SELECT id, category_id, indicator_code, is_gate FROM rubric_indicators WHERE status='active'") as $row) {
    $indicatorMap[$row['indicator_code']] = $row;
}

$insert = $pdo->prepare(
    "INSERT INTO ai_audit_results
        (meeting_id, session_id, category_id, indicator_id, status_code, is_gate, ai_evidence, reason, scored_at, created_at, updated_at)
     VALUES
        (:meeting_id, :session_id, :category_id, :indicator_id, :status_code, :is_gate, :ai_evidence, :reason, NOW(), NOW(), NOW())
     ON DUPLICATE KEY UPDATE
        status_code = VALUES(status_code),
        ai_evidence = VALUES(ai_evidence),
        reason      = VALUES(reason),
        scored_at   = VALUES(scored_at),
        updated_at  = NOW()"
);

$inserted = 0;
$skipped  = [];

foreach ($scores as $code => $entry) {
    if (!isset($indicatorMap[$code])) {
        $skipped[] = $code; // code the model invented, or an inactive/renamed indicator
        continue;
    }
    $ind = $indicatorMap[$code];

    $insert->execute([
        ':meeting_id'   => $meetingId,
        ':session_id'   => $sessionId,
        ':category_id'  => $ind['category_id'],
        ':indicator_id' => $ind['id'],
        ':status_code'  => array_key_exists('s', $entry) ? $entry['s'] : null, // keep NULL as NULL, don't coerce to 0
        ':is_gate'      => $ind['is_gate'],       // from DB, not from the model
        ':ai_evidence'  => $entry['e'] ?? null,
        ':reason'       => $entry['r'] ?? null,
    ]);
    $inserted++;
}

echo "Inserted/updated {$inserted} rows for meeting {$meetingId} session {$sessionId}.\n";
if ($skipped) {
    echo "Skipped unknown codes: " . implode(', ', $skipped) . "\n";
}

// Optional: flag runs where the model reused the same evidence quote across
// many indicators, since that's the low-quality pattern we saw earlier.
$evidenceCounts = [];
foreach ($scores as $entry) {
    if (!empty($entry['e'])) {
        $evidenceCounts[$entry['e']] = ($evidenceCounts[$entry['e']] ?? 0) + 1;
    }
}
$reused = array_filter($evidenceCounts, fn($c) => $c >= 3);
if ($reused) {
    echo "Warning: evidence quote reused 3+ times (possible low-quality audit):\n";
    foreach ($reused as $quote => $count) {
        echo "  ({$count}x) {$quote}\n";
    }
}
