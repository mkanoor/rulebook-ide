# Source and Filter Name Backward Compatibility

The Ansible Rulebook IDE supports backward compatibility with older ansible-rulebook versions that use the legacy source and filter naming conventions.

## Source and Filter Name Formats

There are two source name formats supported:

### New Format (Default)
- **Prefix**: `eda.builtin.*`
- **Example**: `eda.builtin.range`, `eda.builtin.webhook`
- **Used in**: ansible-rulebook v1.0.0+

### Legacy Format
- **Prefix**: `ansible.eda.*`
- **Example**: `ansible.eda.range`, `ansible.eda.webhook`
- **Used in**: ansible-rulebook pre-v1.0.0

## Supported Source Names

The following sources support both naming formats:

### Event Sources
| New Format | Legacy Format |
|------------|---------------|
| `eda.builtin.range` | `ansible.eda.range` |
| `eda.builtin.webhook` | `ansible.eda.webhook` |
| `eda.builtin.generic` | `ansible.eda.generic` |
| `eda.builtin.pg_listener` | `ansible.eda.pg_listener` |

### Event Filters
| New Format | Legacy Format |
|------------|---------------|
| `eda.builtin.normalize_keys` | `ansible.eda.normalize_keys` |
| `eda.builtin.dashes_to_underscores` | `ansible.eda.dashes_to_underscores` |
| `eda.builtin.noop` | `ansible.eda.noop` |
| `eda.builtin.json_filter` | `ansible.eda.json_filter` |
| `eda.builtin.insert_hosts_to_meta` | `ansible.eda.insert_hosts_to_meta` |
| `eda.builtin.insert_meta_info` | `ansible.eda.insert_meta_info` |
| `eda.builtin.event_splitter` | `ansible.eda.event_splitter` |

## How to Use

### Setting the Source and Filter Name Format

1. Click the **⚙️ Settings** button in the toolbar
2. Scroll to the **Source Name Format** dropdown
3. Select your preferred format:
   - **New Format (eda.builtin.*)** - Default, for ansible-rulebook v1.0.0+
   - **Legacy Format (ansible.eda.*)** - For older ansible-rulebook versions

**Note:** This setting affects both event sources AND event filters. When you select a format, all sources and filters will be converted to that naming convention.

### Import Behavior

When you import a YAML rulebook:

- The IDE automatically detects the source name format in the imported file
- It converts all source names to match your current setting
- This ensures consistency across your rulebook

**Example:**

If your setting is **New Format** and you import a rulebook with legacy sources:

```yaml
# Imported file (legacy format)
- name: Example Ruleset
  sources:
    - name: range_source
      ansible.eda.range:
        limit: 5
```

It will be automatically converted to:

```yaml
# After import (new format)
- name: Example Ruleset
  sources:
    - name: range_source
      eda.builtin.range:
        limit: 5
```

### Export Behavior

When you export a YAML rulebook:

- All source names are converted to match your current setting
- The exported file will use only one naming convention

**Example:**

If your setting is **Legacy Format**:

```yaml
# Exported file (legacy format)
- name: Example Ruleset
  sources:
    - name: range_source
      ansible.eda.range:
        limit: 5
```

If your setting is **New Format**:

```yaml
# Exported file (new format)
- name: Example Ruleset
  sources:
    - name: range_source
      eda.builtin.range:
        limit: 5
```

## Use Cases

### Working with Older ansible-rulebook Versions

If you're using an older version of ansible-rulebook (pre-v1.0.0):

1. Set **Source Name Format** to **Legacy Format**
2. All exports will use `ansible.eda.*` naming
3. Your rulebooks will be compatible with older ansible-rulebook versions

### Migrating to Newer ansible-rulebook Versions

If you're upgrading to ansible-rulebook v1.0.0+:

1. Set **Source Name Format** to **New Format**
2. Import your old rulebooks (they'll be auto-converted)
3. Export the updated rulebooks with the new naming convention

### Team Collaboration

If your team uses different ansible-rulebook versions:

1. **For the team member using the latest version:**
   - Use **New Format** setting
   - Export rulebooks for your own use

2. **When sharing with team members on older versions:**
   - Temporarily switch to **Legacy Format**
   - Export the rulebook
   - Share the legacy-formatted YAML

## Technical Details

### How Conversion Works

The IDE includes a source name converter utility (`src/utils/sourceNameConverter.ts`) that:

1. Maintains a mapping of new → legacy names for both sources and filters
2. Automatically converts source and filter names during import/export
3. Preserves all other rulebook structure and data (arguments, parameters, etc.)
4. Processes filters within each source's `filters` array

### Filter Conversion Process

When converting filters:

1. **Detection**: The converter identifies each filter by its key in the filter object
2. **Mapping**: Checks if the filter name exists in the conversion mapping
3. **Conversion**: Converts the filter name to the target format
4. **Preservation**: All filter arguments and configuration remain unchanged

**Example filter conversion:**

```yaml
# Before (legacy format)
filters:
  - ansible.eda.json_filter:
      filter: "{{ event.data }}"

# After (new format)
filters:
  - eda.builtin.json_filter:
      filter: "{{ event.data }}"  # Arguments unchanged
```

### Storage

Your preferred source name format is saved in browser `localStorage`:

```javascript
{
  "sourceNameFormat": "new" // or "legacy"
}
```

This setting persists across browser sessions.

## Troubleshooting

### Source or Filter Not Converting

**Problem**: A source or filter name isn't being converted

**Solution**: Check if the source/filter is in the supported list above. Custom sources or filters (not in the `eda.builtin.*` or `ansible.eda.*` namespace) are not converted and remain unchanged.

### Execution Errors After Export

**Problem**: ansible-rulebook fails to execute the exported YAML

**Solution**:
- Check your ansible-rulebook version: `ansible-rulebook --version`
- If pre-v1.0.0, use **Legacy Format** setting
- If v1.0.0+, use **New Format** setting

### Mixed Format in Exported YAML

**Problem**: Some sources/filters use new format, others use legacy

**Solution**: This should not happen. If it does:
1. Check that all your sources and filters are in the supported list
2. Try re-importing the rulebook
3. Verify your Source Name Format setting
4. Export again

**Note**: Custom sources/filters (e.g., `mycompany.custom.webhook`) will keep their original names and won't be converted. This is expected behavior.

## Best Practices

1. **Use New Format by default** - Unless you have a specific reason to use legacy format
2. **Be consistent** - Don't mix formats within the same rulebook
3. **Check before sharing** - Verify the recipient's ansible-rulebook version before exporting
4. **Document your choice** - If using legacy format, document why in your team's README

## Examples

### Example 1: Creating a New Rulebook with Filters for Legacy System

```yaml
# Server Settings: Source Name Format = Legacy Format
- name: Legacy System Rulebook
  hosts: all
  sources:
    - name: webhook_source
      ansible.eda.webhook:
        host: 0.0.0.0
        port: 5000
      filters:
        - ansible.eda.normalize_keys:
            normalize_keys: true
        - ansible.eda.json_filter:
            filter: "{{ event.payload }}"
  rules:
    - name: Handle Webhook
      condition: event.type == "alert"
      actions:
        - debug:
            msg: "Alert received"
```

### Example 2: Importing and Converting Old Rulebook with Filters

```yaml
# Original imported file (legacy format)
- name: Old Rulebook
  sources:
    - name: range_source
      ansible.eda.range:
        limit: 10
      filters:
        - ansible.eda.normalize_keys:
            normalize_keys: true
        - ansible.eda.dashes_to_underscores: {}

# After import with "New Format" setting
- name: Old Rulebook
  sources:
    - name: range_source
      eda.builtin.range:
        limit: 10
      filters:
        - eda.builtin.normalize_keys:
            normalize_keys: true
        - eda.builtin.dashes_to_underscores: {}
```

**What happened:**
- Source name converted: `ansible.eda.range` → `eda.builtin.range`
- Filter names converted: `ansible.eda.normalize_keys` → `eda.builtin.normalize_keys`
- Filter names converted: `ansible.eda.dashes_to_underscores` → `eda.builtin.dashes_to_underscores`
- All filter arguments preserved unchanged

## Related Documentation

- [Server Settings Guide](./SERVER_SETTINGS.md)
- [YAML Import/Export Guide](./YAML_IMPORT_EXPORT.md)
- [ansible-rulebook Documentation](https://ansible.readthedocs.io/projects/rulebook/)
