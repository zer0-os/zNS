#!/bin/bash

tag=$(git describe --tags --abbrev=0)
echo "Last tag: $tag"
commit=$(git rev-list -n 1 "$tag")
echo "Commit: $commit"
echo "$tag:$commit" > ./artifacts/git-tag.txt
echo "Git tag saved to ./artifacts/git-tag.txt"