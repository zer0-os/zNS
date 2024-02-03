[![codecov](https://codecov.io/gh/zer0-os/zNS/branch/master/graph/badge.svg?token=1L1P9CO4IU)](https://codecov.io/gh/zer0-os/zNS)

[![CircleCI](https://dl.circleci.com/status-badge/img/gh/zer0-os/zNS/tree/development.svg?style=svg)](https://dl.circleci.com/status-badge/redirect/gh/zer0-os/zNS/tree/development)

# zNS - Zer0 Name Service Protocol
________________________________________________________

## System Documentation

### [System Architecture](./docs/architecture.md)
### [Smart Contract Docs](./docs/contracts)
### [Flow Diagrams](./docs/flows.md)

**Full Protocol Documentation - [zero.study](https://www.zero.study/)**
________________________________________________________

## About
Zer0 Name Service, or zNS, is a protocol that allows you to create domain and subdomain NFTs that focus on community building and creation of unique, on-chain identification.

Zero Website - [zero.tech](https://zero.tech/)

## Developers

### Install Dependencies
We are using `yarn` as our package manager.
```bash
yarn install
```
> **Docker Engine** is required to run tests locally. You can install it from [here](https://docs.docker.com/engine/install/).

### Setup Environment
Create `.env` file in the root directory and add the following variables:
```bash
ENV_LEVEL: "dev" # local dev environment
MONGO_DB_URI: "mongodb://localhost:27018" # local instance of MongoDB in the Docker
MONGO_DB_NAME: "zns-campaign" # name of the database
MOCK_MEOW_TOKEN: "true" # use mock MeowToken contract for local testing
SILENT_LOGGER: "true" # disable logging for tests
```

The full ENV setup with descriptions can be found in the [.env.sample](./.env.sample) file.

### Build
```bash
yarn build
```
This will compile all the contracts and add a git tag and a last commit for the current version of the contracts
that is **required** for the MongoDB where deployed contract data is stored.

This will also run a bash script that will pull **tag and commit** from git and write
it locally to `./artifacts/git-tag.txt` file. If you are using Windows, that script may fail. In that case you can
pull git data manually and write it to the file or use the TS based script here: `./src/utils/save-tag.ts` simply by running `yarn save-tag`
The resulting text in the `./artifacts/git-tag.txt` file should look like this:
```
v1.0.1:213334f3d4f47940779cb7e825aaf1fab77adb2e
```

### Run Tests
```bash
yarn test
```
This will launch `docker-compose` with MongoDB instance on it, required for some tests. Then launch all the tests in the `./test` directory.

> Note: If you do not have Docker installed this will fail.

### Submit Work
All new code is submitted through Pull Requests **ONLY**. Please make sure that you have all the tests passing in CircleCI and that
you have added new tests for your code before submitting for review. Codecov will fail the CI if the coverage drops. Pull Requests are not merged with a failing CI build.

All new code is merged into `development` branch and that will make a new prerelease tag.
`master` branch is used for production releases only. Code from `development` branch should be fully tested on the testnet before merging into `master`.
