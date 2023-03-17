# DDF Validator Action

Validate DDF files in a directory.

## Usage:

```yaml
name: build-test
on: # rebuild any PRs and main branch changes
  pull_request:
  push:
    branches:
      - main

jobs:
  validate:
    name: Validate DDF files
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: deconz-community/ddf-validator-action@v1
        with:
          directory: /tests
```