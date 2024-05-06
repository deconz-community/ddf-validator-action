# DDF Validator Action

Validate DDF files in a directory.

> [!IMPORTANT]
> This action is now deprecated, please use [deconz-community/ddf-tools-action](https://github.com/deconz-community/ddf-tools-action) now.

## Usage:

```yaml
name: build-test
on: # rebuild any PRs and main branch changes
  workflow_dispatch:
    inputs:
      noSkip:
        description: Don't skip files when validating
        required: true
        default: true
        type: boolean
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
          directory: devices
          generic: devices/generic
          search: '**/*.json'
          # ignore: '**/generic/**'
          no-skip: ${{ inputs.noSkip == true }}
```