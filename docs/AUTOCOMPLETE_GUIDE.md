# Condition Autocomplete Guide

The Rulebook IDE includes intelligent autocomplete for writing condition expressions. This guide explains how to use it effectively.

## How to Activate Autocomplete

### Automatic Activation

Autocomplete appears automatically in the following situations:

1. **When you start typing**
   - Begin typing in any condition field
   - Suggestions appear immediately

2. **After typing a dot (.)**

   ```
   event.     ← Autocomplete shows field suggestions
   ```

3. **After typing a variable**

   ```
   event.severity     ← Autocomplete shows operators (==, !=, etc.)
   ```

4. **After typing an operator**
   ```
   event.severity ==     ← Autocomplete shows value types
   ```

### Manual Activation

Press the trigger key at any time to manually show suggestions:

- **Windows/Linux**: `Ctrl+Space`
- **Mac**: `⌘Space` (Cmd+Space)

> 💡 **Tip**: The keyboard shortcut is displayed as a badge next to the input field and in the autocomplete dropdown footer.

## Keyboard Shortcuts

| Key                    | Action                             | Platform      |
| ---------------------- | ---------------------------------- | ------------- |
| **Ctrl+Space**         | Show/hide autocomplete suggestions | Windows/Linux |
| **⌘Space** (Cmd+Space) | Show/hide autocomplete suggestions | Mac           |
| **↑ Arrow**            | Navigate to previous suggestion    | All           |
| **↓ Arrow**            | Navigate to next suggestion        | All           |
| **Enter**              | Insert selected suggestion         | All           |
| **Tab**                | Insert selected suggestion         | All           |
| **Escape**             | Close autocomplete dropdown        | All           |

## Using the Mouse

- **Hover** over a suggestion to highlight it
- **Click** on a suggestion to insert it
- Scroll through the list if there are many suggestions

## Suggestion Types

Autocomplete provides different types of suggestions, each with an icon:

| Icon | Type     | Description                  | Example           |
| ---- | -------- | ---------------------------- | ----------------- |
| 📊   | Variable | Event/fact/var fields        | `event.type`      |
| ⚡   | Operator | Comparison/logical operators | `==`, `and`, `in` |
| ⚙️   | Function | Built-in functions           | `selectattr()`    |
| 🔤   | Keyword  | Reserved keywords            | `true`, `false`   |
| 💎   | Value    | Value placeholders           | `""`, `123`, `[]` |

## Common Use Cases

### 1. Starting a New Condition

**What to type:**

```
(empty field)
```

**What you'll see:**

- `event.` - Access current event fields
- `events.` - Access event buffer
- `fact.` - Access Ansible facts
- `vars.` - Access custom variables

**Example suggestions:**

- `event.type` - Event type
- `event.severity` - Event severity
- `event.message` - Event message

### 2. Accessing Event Fields

**What to type:**

```
event.
```

**What you'll see:**

- `type` - Event type
- `severity` - Event severity
- `status` - Event status
- `message` - Event message
- `timestamp` - Event timestamp
- `host` - Event host
- `user` - Event user
- `payload` - Event payload data

**Example:**

```
event.se     ← Type "se" to filter
```

Shows: `severity`, `status` (filtered results)

### 3. Adding Comparison Operators

**What to type:**

```
event.severity
```

**What you'll see:**

- `==` - Equal to
- `!=` - Not equal to
- `<` - Less than
- `>` - Greater than
- `<=` - Less than or equal
- `>=` - Greater than or equal
- `in` - Check if in list
- `contains` - Check if contains value

### 4. Comparing Values

**What to type:**

```
event.severity ==
```

**What you'll see:**

- `""` - String value (e.g., "critical")
- `123` - Number value
- `true`/`false` - Boolean values
- `event.` - Compare with another event field

**Example completion:**

```
event.severity == "critical"
```

### 5. Combining Conditions

**What to type:**

```
event.severity == "critical"
```

**What you'll see:**

- `and` - Both conditions must be true
- `or` - At least one condition must be true
- `not` - Negate the next condition

**Example completion:**

```
event.severity == "critical" and event.status == "open"
```

### 6. Using Functions

**What to type:**

```
events.
```

**What you'll see:**

- `selectattr()` - Filter list by attribute
- `select()` - Filter list by condition
- `map()` - Transform list elements
- `length()` - Get length of list

#### Function: `selectattr()`

Filters a list by matching an attribute value.

**Syntax:** `selectattr(key, operator, value)`

**Parameters:**

- `key` - Attribute name to check (string)
- `operator` - Comparison operator (`"=="`, `"!="`, `"<"`, `">"`, etc.)
- `value` - Value to compare against

**Examples:**

```
# Filter events where type equals "alert"
events.selectattr("type", "==", "alert")

# Filter events where severity is not "low"
events.selectattr("severity", "!=", "low")

# Filter events where count is greater than 5
events.selectattr("count", ">", 5)
```

#### Function: `select()`

Filters a list by applying a condition or pattern operation.

**Syntax:** `select(operator, value)`

**Parameters:**

- `operator` - Operation to perform (e.g., `"search"`, `"match"`, `"equalto"`)
- `value` - Expression or pattern to apply

**Common Operators:**

- `"search"` - Search for pattern in values (supports regex)
- `"match"` - Match against a pattern
- `"equalto"` - Check equality
- `"defined"` - Check if value is defined

**Examples:**

```
# Search for events containing a specific pattern in a field
select("search", events.m_0.request.friend_name)

# Match events based on a pattern
select("match", event.hostname)

# Filter for defined values
select("defined", event.optional_field)

# Check equality
select("equalto", event.status)
```

**When to use `select()` vs `selectattr()`:**

- Use `selectattr()` when filtering by a specific attribute with a comparison
- Use `select()` when applying pattern matching, searching, or complex filters

## Tips and Tricks

### Tip 1: Filter Suggestions by Typing

Keep typing to filter the suggestion list:

```
ev     ← Shows: event., events.
even   ← Shows: event.
event. ← Shows: field suggestions
```

### Tip 2: Use Ctrl+Space When Stuck

If autocomplete doesn't appear or you closed it:

- Press `Ctrl+Space` to bring it back
- Works at any cursor position

### Tip 3: Let Autocomplete Guide You

Not sure what fields are available? Type `event.` and browse the suggestions!

### Tip 4: Common Patterns

**Check if event field equals a value:**

```
event.status == "active"
```

**Check if event field is in a list:**

```
event.level in ["error", "critical"]
```

**Combine multiple conditions:**

```
event.severity == "high" and event.status == "open"
```

**Check if field contains text:**

```
event.message contains "error"
```

**Filter events list:**

```
events.selectattr("type", "==", "alert")
```

## Troubleshooting

### Autocomplete doesn't appear

1. Make sure you're clicking in the condition input field
2. Try pressing `Ctrl+Space` manually
3. Start typing - it should appear after 1-2 characters

### Wrong suggestions appear

1. The autocomplete is context-aware based on what you've typed
2. Keep typing to filter suggestions
3. Use arrow keys to find the right suggestion

### Can't select a suggestion

1. Try using keyboard: `↓` to select, `Enter` to insert
2. Make sure you're clicking directly on the suggestion item
3. If dropdown closes, press `Ctrl+Space` to reopen

### Suggestion inserted in wrong place

1. Click to position your cursor where you want the suggestion
2. Then trigger autocomplete with `Ctrl+Space`
3. The suggestion will insert at cursor position

## Examples

### Example 1: Simple Equality Check

```
Type: ev
Select: event.
Type: ty
Select: type
Type: ==
Select: ==
Type: "al
Insert: "alert"

Result: event.type == "alert"
```

### Example 2: Severity Range Check

```
Type: event.severity
Select: >=
Type: 7
Type: and
Select: and
Type: event.severity
Select: <=
Type: 10

Result: event.severity >= 7 and event.severity <= 10
```

### Example 3: Multiple Conditions

```
Type: event.status == "open"
Select: and
Type: event.assigned_to is not
Select: is not
Type: null

Result: event.status == "open" and event.assigned_to is not null
```

### Example 4: Using Functions

```
Type: events
Select: events.
Type: sel
Select: selectattr("type", "==", "")
Edit: selectattr("type", "==", "alert")
Type: | length > 5

Result: events.selectattr("type", "==", "alert") | length > 5
```

## Learn More

- The autocomplete uses the same PEG parser that validates your conditions
- Suggestions are based on valid ansible-rulebook syntax
- Invalid syntax will be highlighted with validation errors

For more information about condition syntax, see the ansible-rulebook documentation.
