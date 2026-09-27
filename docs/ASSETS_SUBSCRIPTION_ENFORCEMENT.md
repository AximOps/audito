# Assets subscription enforcement

## Capacity rule

The module counts assets whose status is `Active` or `Inactive`. `Retired` assets do not consume the organization's asset allowance.

## Create

`POST /api/assets` calls `requireAssetCapacity()` before insertion. If the limit would be exceeded it returns HTTP 409 with:

```json
{
  "error": "Asset subscription limit reached.",
  "code": "PLAN_LIMIT_REACHED",
  "resource": "assets",
  "limit": 25,
  "current": 25,
  "plan": "FREE"
}
```

## Reactivation

Changing a Retired asset back to Active/Inactive also checks the current plan capacity. Editing an already-counted asset does not consume additional capacity.

## Removal

The DELETE endpoint retires the asset instead of physically deleting it. This preserves the asset record and history while releasing subscription capacity.
