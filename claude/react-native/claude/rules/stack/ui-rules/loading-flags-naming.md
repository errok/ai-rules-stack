---
description: Naming for loading booleans — is{Domain}Loading, not isFetching / LoadingLoading. Applies to useState flags in screens, components, hooks, stores.
paths:
  - "screens/**/*.tsx"
  - "components/**/*.tsx"
  - "hooks/**/*.ts"
  - "stores/**/*.ts"
---

# Loading flags naming

Use boolean flags that read well in JSX and describe **what is loading**, not **how**.

- **Pattern**: `is{Domain}Loading`
  - Domain = the thing being loaded (noun), singular/plural as appropriate.
- **Avoid**: prefixes like `isFetching...` / suffixes like `...LoadingLoading`.

## Examples

```ts
// ✅ GOOD
const [isCategoriesLoading, setIsCategoriesLoading] = useState(false);
const [isFreeActivitiesLoading, setIsFreeActivitiesLoading] = useState(false);
const [isCreateActivityLoading, setIsCreateActivityLoading] = useState(false);

// ❌ BAD
const [isFetchingCategoriesLoading, setIsFetchingCategoriesLoading] = useState(false);
const [isFetchCategoriesLoading, setIsFetchCategoriesLoading] = useState(false);
```
