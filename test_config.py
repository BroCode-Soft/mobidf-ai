#!/usr/bin/env python3
"""
Test script to validate backend configuration with various CORS_ORIGINS values
"""

import os
import sys

# Test different CORS_ORIGINS values
test_cases = [
    ("Normal comma-separated", "http://localhost:3000,https://mobidf.brocode.net.br"),
    ("Single origin", "http://localhost:3000"),
    ("With spaces", "http://localhost:3000 , https://mobidf.brocode.net.br"),
    ("Empty string", ""),
    ("Whitespace", "   "),
]

print("╔═══════════════════════════════════════════════════════════════╗")
print("║  Testing backend configuration with various CORS_ORIGINS    ║")
print("╚═══════════════════════════════════════════════════════════════╝\n")

for name, cors_value in test_cases:
    print(f"Test: {name}")
    print(f"  Input: '{cors_value}'")
    
    # Set environment variable
    os.environ["CORS_ORIGINS"] = cors_value
    
    try:
        # Import here so environment variable is set first
        from backend.app.config import get_settings
        
        settings = get_settings()
        print(f"  ✓ Parsed: '{settings.cors_origins}'")
        print(f"  ✓ List: {settings.cors_origins_list}")
        print(f"  Status: ✅ PASS\n")
    except Exception as e:
        print(f"  ✗ Error: {str(e)}")
        print(f"  Status: ❌ FAIL\n")
    
    # Clear cache for next test
    if 'get_settings' in sys.modules:
        try:
            get_settings.cache_clear()
        except:
            pass

print("\n✅ All tests completed!")
