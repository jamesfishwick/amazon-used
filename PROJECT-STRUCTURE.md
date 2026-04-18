# Cheapest Read — Project Structure

## Core Extension Files (Production)

```
/
├── manifest.json           # Extension configuration and permissions
├── background.js          # Service worker - handles tab creation and messaging
├── content.js            # Content script for wishlist pages
├── offers-content.js     # Content script for offers pages
├── popup.html           # Extension popup interface
└── popup.js            # Popup logic
```

## Documentation

```
├── README.md            # Main project documentation
├── CLAUDE.md           # Claude-specific instructions
├── DEVELOPMENT.md      # Development notes
├── INSTALLATION.md     # Installation instructions
└── PROJECT-STRUCTURE.md # This file
```

## Development Files

```
├── package.json        # Node.js dependencies
├── .gitignore         # Git ignore rules
├── tests/             # All test scripts
│   ├── README.md      # Test documentation
│   ├── test-new-extension.js     # Main extension test
│   ├── test-wait-for-offers.js   # Offers loading test
│   ├── test-all-offers-display.js # Display parsing test
│   └── [other test files...]
├── archive/           # Archived/old files
│   ├── background-old.js
│   ├── priceChecker.worker.js
│   ├── window.html
│   └── window.js
└── screenshots/       # Test screenshots
    ├── verify_Grinderman_2_Eco.png
    ├── verify_Moral_Codes.png
    └── verify_The_Dawn_of_Everything.png
```

## File Dependencies

### manifest.json references:
- background.js (service worker)
- content.js (wishlist content script)
- offers-content.js (offers content script)  
- popup.html (extension popup)

### popup.html references:
- popup.js (popup functionality)

## Extension Architecture

1. **User visits wishlist** → content.js loads
2. **content.js** detects products → sends message to background.js
3. **background.js** opens offers page in hidden tab
4. **offers-content.js** waits for page load → extracts real prices
5. **Results sent back** → content.js displays prices in wishlist

All files are actively used - no orphaned files remain.