#!/bin/bash
# Sync web app's lib/ → shared package
# Run from rent-right-shared/ after editing shared files in the web app

SRC="../rent-right/lib"
DEST="src"

FILES=(
  vaultTypes.ts
  geocode.ts
  formatPhone.ts
  propertyTypes.ts
  mapTypes.ts
  vacancyUtils.ts
  geo.ts
  cityAreas.ts
)

for f in "${FILES[@]}"; do
  cp "$SRC/$f" "$DEST/$f"
  echo "✓ $f → shared"
done

# mapConstants needs path rewrite (remove @/ alias for shared package)
sed 's|from '\''@/data/coastlines/|from '\''./data/coastlines/|g' "$SRC/mapConstants.ts" > "$DEST/mapConstants.ts"
echo "✓ mapConstants.ts → shared (with relative paths)"

echo "Done! Mobile app will pick up changes automatically."
