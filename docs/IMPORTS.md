# Contact Import Engine Specification

## 1. Supported Formats
- `.csv`
- `.xlsx` / `.xls`

## 2. Importer Workflow
1. **Upload File**: Multipart form upload to `/api/contacts/import/upload`.
2. **Column Auto-Detection**: Analyzes headers for `phone`, `name`, `email`, `tags`, `notes`.
3. **Interactive Column Mapping**: Re-map columns via UI. Unmapped columns are saved as custom fields in `contacts.custom_fields` (JSONB).
4. **Validation & E.164 Normalization**: Strips non-digit characters and validates phone numbers.
5. **Duplicate Resolution Strategies**:
   - `SKIP`: Ignores row if phone number exists in DB.
   - `UPDATE`: Updates existing contact fields with file data.
6. **Error Reporting**: Failed rows generate a downloadable CSV error report containing row index and error details.
