# SADIYA Plugin Skeleton

Future SADIYA modules can declare their capabilities with a manifest:

```json
{
  "id": "calendar",
  "name": "Calendar",
  "permissions": ["calendar.read", "calendar.write"],
  "commands": ["list_events", "create_event"],
  "safetyLevel": "confirmation-required"
}
```

The MVP includes a plugin registry in app state. Runtime plugin loading can be added after the core desktop assistant is stable.
