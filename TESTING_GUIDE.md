# Session Quality Report - Testing & Integration Guide

## Quick Start Testing

### 1. Access the Report Page

Navigate to:
```
http://localhost:3000/admin/reports/session-quality?meeting_id=YOUR_MEETING_ID
```

**Requirements**:
- Must be logged in as `admin` or `super_admin` role
- Meeting ID must exist in the `meetings` table
- Optionally: data in the corresponding tutoring tables

### 2. Find Available Meeting IDs

```bash
# Via browser console (logged in as admin):
fetch('/api/meetings', { credentials: 'include' })
  .then(r => r.json())
  .then(d => d.data.forEach(m => console.log(m.meeting_id)))
```

Or query database directly:
```sql
SELECT meeting_id, title, status FROM meetings LIMIT 10;
```

### 3. Test the API Endpoint

```bash
# From terminal (requires auth token):
curl -X GET "http://localhost:3000/api/tutoring/report/your-meeting-id" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Cookie: auth_token=YOUR_AUTH_TOKEN"
```

### 4. Expected API Response Structure

```json
{
  "metadata": {
    "meeting_id": "viu-weqt-ecv",
    "student_name": "John Doe",
    "student_grade": "10th",
    "subject": "Mathematics",
    "topic": "Algebra",
    "teacher_user_id": 1
  },
  "report": {
    "overall_score": 85,
    "percentage_score": 85,
    "overall_rating": "Excellent",
    "student_engagement": "High",
    "learning_impact": "Strong",
    "executive_summary": "Well-structured session..."
  },
  "analysis": [
    {
      "id": 1,
      "analysis_type": "strength",
      "description": "Clear explanation of concepts"
    }
  ],
  "impact": [
    {
      "impact_area": "Concept Understanding",
      "observation": "Student grasped key concepts",
      "impact_level": "Strong"
    }
  ],
  "parentSummary": {
    "what_was_covered": "Basic algebra...",
    "how_student_participated": "Actively engaged...",
    "progress_noticed": "Significant improvement..."
  },
  "coaching": [
    {
      "feedback_type": "strength",
      "area": "Explanation clarity",
      "evidence": "Students understood concepts easily"
    }
  ],
  "betterAlternatives": [
    {
      "transcript_situation": "Student confused about...",
      "better_alternative": "Try using visual aids..."
    }
  ],
  "nextPlan": {
    "priority_focus": "Reinforce algebraic concepts",
    "recap_warmup": "Review key formulas",
    "suggested_homework": "5 practice problems"
  },
  "flags": [
    {
      "flag_description": "Low student engagement in first 10 min",
      "severity": "Low"
    }
  ],
  "finalEval": {
    "overall_session_rating": "Excellent",
    "teacher_performance": "Strong",
    "student_engagement": "High",
    "recommended_action": "Continue"
  }
}
```

## Creating Test Data

### Option 1: Using Database Directly

```sql
-- Insert test metadata
INSERT INTO session_metadata 
(meeting_id, student_name, student_grade, subject, topic, teacher_user_id)
VALUES ('test-meeting-001', 'Test Student', '10th', 'Math', 'Algebra', 1);

-- Insert test report
INSERT INTO session_quality_reports
(meeting_id, overall_score, max_possible_score, percentage_score, overall_rating, 
 student_engagement, learning_impact, executive_summary)
VALUES ('test-meeting-001', 85, 100, 85, 'Excellent', 
        'High', 'Strong', 'Well-structured session with clear learning outcomes');

-- Insert analysis items
INSERT INTO session_analysis 
(meeting_id, analysis_type, description, evidence)
VALUES ('test-meeting-001', 'strength', 'Clear explanations', 
        'Student understood concepts on first attempt');

-- Insert impact data
INSERT INTO student_learning_impact
(meeting_id, impact_area, observation, impact_level)
VALUES ('test-meeting-001', 'Concept Understanding', 
        'Student grasped algebraic concepts', 'Strong');
```

### Option 2: Using the API (POST endpoints)

```bash
# Create metadata
curl -X POST "http://localhost:3000/api/tutoring/metadata" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "meeting_id": "test-001",
    "student_name": "Test Student",
    "subject": "Mathematics",
    "student_grade": "10th"
  }'

# Create report
curl -X POST "http://localhost:3000/api/tutoring/reports" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "meeting_id": "test-001",
    "overall_score": 85,
    "percentage_score": 85,
    "overall_rating": "Excellent"
  }'
```

## Browser Testing Steps

### 1. Login as Admin
1. Go to `http://localhost:3000/login`
2. Enter admin credentials
3. Verify you're logged in

### 2. Navigate to Report Page
1. Click on **Sidebar → Reports → Session Quality Report**
   OR
2. Direct URL: `/admin/reports/session-quality?meeting_id=viu-weqt-ecv`

### 3. Verify Page Elements
- [ ] Session Snapshot card displays
- [ ] Report Summary card shows scores
- [ ] Status card shows generation info
- [ ] All 9 report sections load
- [ ] Refresh button works
- [ ] Download button works
- [ ] Error messages display appropriately

### 4. Test Different Scenarios

**Scenario 1: Meeting with no data**
```
/admin/reports/session-quality?meeting_id=non-existent
```
Expected: All sections show "No items available" / "N/A"

**Scenario 2: Meeting with partial data**
```
/admin/reports/session-quality?meeting_id=meeting-with-some-data
```
Expected: Some sections populate, others show empty

**Scenario 3: Meeting with full data**
```
/admin/reports/session-quality?meeting_id=viu-weqt-ecv
```
Expected: All sections populate with real data

## Common Issues & Troubleshooting

### Issue: "Unauthorized: missing token"
**Solution**: 
- Login first at `/login`
- Verify auth_token cookie is set
- Check Authorization header in API calls

### Issue: "No meeting_id query parameter"
**Solution**:
- Add `?meeting_id=<ID>` to the URL
- Verify meeting_id format is correct

### Issue: All sections show "N/A" / "No items"
**Solution**:
- Create test data using SQL or API
- Verify meeting_id exists in `meetings` table
- Check data was inserted into correct tutoring tables

### Issue: 404 on report page
**Solution**:
- Verify server is running (`npm start`)
- Check URL format: `/admin/reports/session-quality`
- Verify admin/super_admin role is assigned

### Issue: Sidebar menu item doesn't appear
**Solution**:
- Re-run seeder: `npm run db:seed`
- Clear browser cache
- Verify role is admin or super_admin

## Database Query Reference

### Check if data exists
```sql
-- Check metadata
SELECT * FROM session_metadata WHERE meeting_id = 'your-id';

-- Check report
SELECT * FROM session_quality_reports WHERE meeting_id = 'your-id';

-- Check analysis
SELECT * FROM session_analysis WHERE meeting_id = 'your-id';

-- Check all in one query
SELECT 
  (SELECT COUNT(*) FROM session_metadata WHERE meeting_id = 'your-id') as metadata,
  (SELECT COUNT(*) FROM session_quality_reports WHERE meeting_id = 'your-id') as reports,
  (SELECT COUNT(*) FROM session_analysis WHERE meeting_id = 'your-id') as analysis,
  (SELECT COUNT(*) FROM student_learning_impact WHERE meeting_id = 'your-id') as impact;
```

## Browser Console Testing

```javascript
// Test in browser console (logged in as admin)

// 1. Check if apiFetch is available
typeof apiFetch

// 2. Manually fetch report data
apiFetch('/api/tutoring/report/viu-weqt-ecv')
  .then(data => console.log('Report data:', data))
  .catch(err => console.error('Error:', err))

// 3. Check current page URL
window.location.href

// 4. Get meeting_id from URL
new URLSearchParams(window.location.search).get('meeting_id')
```

## Performance Considerations

- **Parallel Loading**: The aggregate endpoint uses `Promise.all()` to fetch all 10 sections in parallel (very fast)
- **Caching**: Consider adding browser cache headers for read-only reports
- **Large Datasets**: Works efficiently with up to 1000+ analysis/impact/feedback items per meeting

## Future Enhancements

- [ ] Export to PDF with formatting
- [ ] Edit mode for admin users
- [ ] Historical report comparison
- [ ] Batch report generation
- [ ] Email report to stakeholders
- [ ] Real-time data visualization charts
- [ ] Custom report templates per school/department
