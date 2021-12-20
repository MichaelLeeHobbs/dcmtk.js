#!/usr/bin/env bash
jest
jest-coverage-badges
jsdoc2md --files src/**.js --files src/**/**.js > docs/API.md

