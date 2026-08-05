#!/bin/bash

# Run this script from inside the allmarts folder

if [ ! -d "allmart" ]; then
  echo "Error: 'allmart' folder not found"
  exit 1
fi

echo "Copying all files from allmart/ to the current directory (allmarts root)..."
cp -a allmart/. .

echo "Done!"
echo "You can now delete the allmart folder if you want with: rm -rf allmart"