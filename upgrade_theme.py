import os
import re

# Paths to search
DIRS = [
    r"c:\Users\samra\Pictures\food-delivery-platform\app\admin",
    r"c:\Users\samra\Pictures\food-delivery-platform\components\admin"
]

def replace_classes(content):
    # Colors to Backgrounds
    content = re.sub(r'\bbg-gray-950\b', 'bg-background', content)
    content = re.sub(r'\bbg-gray-900\b', 'bg-card', content)
    content = re.sub(r'\bbg-gray-800\b', 'bg-secondary', content)
    content = re.sub(r'\bbg-gray-700\b', 'bg-secondary', content)
    content = re.sub(r'\bbg-gray-100\b', 'bg-secondary', content)
    content = re.sub(r'\bbg-gray-50\b', 'bg-background', content)
    content = re.sub(r'\bbg-black\b', 'bg-background', content)
    content = re.sub(r'\bbg-black/10\b', 'bg-secondary', content)
    content = re.sub(r'\bbg-black/20\b', 'bg-secondary', content)
    content = re.sub(r'\bbg-black/40\b', 'bg-card', content)
    content = re.sub(r'\bbg-black/50\b', 'bg-card', content)
    content = re.sub(r'\bbg-white\b', 'bg-card', content) # risky? but it's admin panel usually dark
    content = re.sub(r'\bbg-\[\#0a0a0a\]\b', 'bg-background', content)
    content = re.sub(r'\bbg-white/5\b', 'bg-secondary/50', content)
    content = re.sub(r'\bbg-white/10\b', 'bg-secondary', content)
    
    # Text colors
    content = re.sub(r'\btext-white\b', 'text-foreground', content)
    content = re.sub(r'\btext-black\b', 'text-foreground', content)
    content = re.sub(r'\btext-gray-900\b', 'text-foreground', content)
    content = re.sub(r'\btext-gray-800\b', 'text-foreground', content)
    content = re.sub(r'\btext-gray-700\b', 'text-muted-foreground', content)
    content = re.sub(r'\btext-gray-600\b', 'text-muted-foreground', content)
    content = re.sub(r'\btext-gray-500\b', 'text-muted-foreground', content)
    content = re.sub(r'\btext-gray-400\b', 'text-muted-foreground', content)
    content = re.sub(r'\btext-gray-300\b', 'text-muted-foreground', content)
    content = re.sub(r'\btext-gray-200\b', 'text-foreground', content)
    content = re.sub(r'\btext-gray-100\b', 'text-foreground', content)
    content = re.sub(r'\btext-white/50\b', 'text-muted-foreground', content)
    content = re.sub(r'\btext-white/70\b', 'text-muted-foreground', content)
    
    # Border colors
    content = re.sub(r'\bborder-white/5\b', 'border-border/50', content)
    content = re.sub(r'\bborder-white/10\b', 'border-border/50', content)
    content = re.sub(r'\bborder-white/20\b', 'border-border', content)
    content = re.sub(r'\bborder-gray-800\b', 'border-border/50', content)
    content = re.sub(r'\bborder-gray-700\b', 'border-border/50', content)
    content = re.sub(r'\bborder-gray-600\b', 'border-border', content)
    content = re.sub(r'\bborder-gray-500\b', 'border-border', content)
    content = re.sub(r'\bborder-gray-200\b', 'border-border/50', content)
    content = re.sub(r'\bborder-gray-100\b', 'border-border/50', content)
    content = re.sub(r'\bborder-black\b', 'border-border', content)
    
    # Hover states
    content = re.sub(r'\bhover:bg-gray-800\b', 'hover:bg-secondary', content)
    content = re.sub(r'\bhover:bg-gray-900\b', 'hover:bg-secondary', content)
    content = re.sub(r'\bhover:bg-white/5\b', 'hover:bg-secondary/50', content)
    content = re.sub(r'\bhover:bg-white/10\b', 'hover:bg-secondary', content)
    content = re.sub(r'\bhover:text-white\b', 'hover:text-foreground', content)
    content = re.sub(r'\bhover:text-gray-200\b', 'hover:text-foreground', content)
    content = re.sub(r'\bhover:text-gray-300\b', 'hover:text-foreground', content)
    
    return content

def main():
    changed_files = 0
    for directory in DIRS:
        for root, dirs, files in os.walk(directory):
            for file in files:
                if file.endswith('.tsx') or file.endswith('.ts'):
                    filepath = os.path.join(root, file)
                    with open(filepath, 'r', encoding='utf-8') as f:
                        content = f.read()
                    
                    new_content = replace_classes(content)
                    
                    if new_content != content:
                        with open(filepath, 'w', encoding='utf-8') as f:
                            f.write(new_content)
                        changed_files += 1
                        print(f"Updated {filepath}")
    
    print(f"Finished updating {changed_files} files.")

if __name__ == "__main__":
    main()
