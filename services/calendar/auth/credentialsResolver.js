const fs = require('fs');
const path = require('path');
const { CREDENTIALS_PATHS, CREDENTIALS_DIR } = require('../config/paths');

class CredentialsResolver {
  constructor(accountName) {
    this.accountName = accountName;
    this.credentialsFile = null;
  }

  setCredentialsFile(filename) {
    this.credentialsFile = filename;
  }

  resolveCredentialsPath() {
    // If a specific credentials file is set for this account, use it first
    if (this.credentialsFile) {
      const specificPath = path.join(__dirname, '../../uploads/google-calendar-json', this.credentialsFile);
      if (fs.existsSync(specificPath)) {
        return specificPath;
      }
    }

    // Fallback to account-based naming
    const accountSpecificPaths = [
      path.join(CREDENTIALS_DIR, `credentials_${this.accountName}.json`),
      path.join(CREDENTIALS_DIR, `credentials-${this.accountName}.json`),
      path.join(CREDENTIALS_DIR, `credentials_${this.accountName}`),
      path.join(CREDENTIALS_DIR, `credentials-${this.accountName}`)
    ];

    for (const candidate of accountSpecificPaths) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }

    // Fallback to default paths
    for (const candidate of CREDENTIALS_PATHS) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }

    throw new Error(`No Google credentials file found for account '${this.accountName}'. Checked: ${[...accountSpecificPaths, ...CREDENTIALS_PATHS].join(', ')}`);
  }
}

module.exports = CredentialsResolver;
