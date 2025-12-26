"""
py2app setup for iMessage Wrapped (menu bar app)
"""
import sys
from pathlib import Path
from setuptools import setup

sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

APP = ['gui.py']
DATA_FILES = []

OPTIONS = {
    'argv_emulation': False,
    'iconfile': 'icon.icns',
    'plist': {
        'CFBundleName': 'iMessage Wrapped',
        'CFBundleDisplayName': 'iMessage Wrapped',
        'CFBundleIdentifier': 'com.imessagewrapped.app',
        'CFBundleVersion': '1.0.10',
        'CFBundleShortVersionString': '1.0.10',
        'NSRequiresAquaSystemAppearance': False,
        'NSHighResolutionCapable': True,
        'LSMinimumSystemVersion': '12.0',
        'LSApplicationCategoryType': 'public.app-category.utilities',
        'NSHumanReadableCopyright': '© 2025 iMessage Wrapped',
        'LSUIElement': True,  # Don't show in Dock (menu bar only)
    },
    'packages': [
        'imessage_wrapped',
        'rich',
        'requests',
        'questionary',
        'rumps',
        'urllib3',
        'certifi',
    ],
    'excludes': [
        'tkinter',
        '_tkinter',
        'numpy',
        'pandas',
        'matplotlib',
        'IPython',
        'jupyter',
        'test',
        'unittest',
        'distutils',
    ],
    'optimize': 2,
    'strip': True,
}

setup(
    app=APP,
    name='iMessage Wrapped',
    data_files=DATA_FILES,
    options={'py2app': OPTIONS},
    setup_requires=['py2app'],
)

