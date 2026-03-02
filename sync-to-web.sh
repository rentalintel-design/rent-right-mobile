#!/bin/bash
# Sync shared files → web app's lib/ folder
# Run from rent-right-shared/ after editing any shared file

SRC="src"
WEB="../rent-right/lib"

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

# mapConstants.ts needs @/ import fix for web
for f in "${FILES[@]}"; do
  cp "$SRC/$f" "$WEB/$f"
  echo "✓ $f → web"
done

# mapConstants needs path rewrite for web (@/ alias)
sed 's|from '\''./data/coastlines/|from '\''@/data/coastlines/|g' "$SRC/mapConstants.ts" > "$WEB/mapConstants.ts"
echo "✓ mapConstants.ts → web (with @/ paths)"

echo "Done! Run 'npm run build' in rent-right to verify."
