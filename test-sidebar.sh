#!/bin/bash
# Quick test script to verify sidebar system is working

echo "🔍 Checking Sidebar System Files..."

# Check if all required files exist
files=(
  "public/sidebar.html"
  "public/js/sidebar-config.js"
  "public/js/sidebar-controller.js"
  "public/css/sidebar.css"
  "routes/sidebar-api.js"
  "SIDEBAR_DOCUMENTATION.md"
)

missing=0
for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    echo "✅ $file"
  else
    echo "❌ MISSING: $file"
    missing=$((missing + 1))
  fi
done

if [ $missing -eq 0 ]; then
  echo ""
  echo "✅ All sidebar files present!"
  echo ""
  echo "📋 Next steps:"
  echo "1. Start the server: npm start"
  echo "2. Navigate to any admin/super_admin/employee/reviewer page"
  echo "3. Check if sidebar appears on the left"
  echo "4. Test sidebar features:"
  echo "   - Click on menu items to navigate"
  echo "   - Click chevron to expand/collapse submenus"
  echo "   - Click collapse button to minimize sidebar"
  echo "   - Check active page highlighting"
  echo "5. Test API: curl http://localhost:5000/api/sidebar/menu"
  echo ""
  echo "📚 For more info, see SIDEBAR_DOCUMENTATION.md"
else
  echo ""
  echo "❌ Some files are missing! Please check the setup."
  exit 1
fi
