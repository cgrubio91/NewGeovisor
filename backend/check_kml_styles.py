import os
import glob

# Encontrar el archivo KML más reciente en uploads
files = glob.glob('uploads/**/*.kml', recursive=True)
if not files:
    print("No KML files found")
    exit()

latest_file = max(files, key=os.path.getmtime)
print(f"Analyzing: {latest_file}")

with open(latest_file, 'r', encoding='utf-8', errors='ignore') as f:
    content = f.read()

# Buscar contextos de color
import re
print("\n--- COLOR ANALYSIS ---")
matches = re.finditer(r'<(\w+Style)>.*?<color>(\w+)</color>.*?</\1>', content, re.DOTALL)
count = 0
for m in matches:
    style_type = m.group(1)
    color = m.group(2)
    print(f"Found {style_type} with color: {color}")
    count += 1
    if count > 5: break

if count == 0:
    # Buscar colores sueltos si el regex complejo falla
    simple_colors = re.findall(r'<color>(\w+)</color>', content)
    print(f"Simple color tags found: {simple_colors[:5]}")
    # Mostrar contexto de los primeros
    idx = content.find("<color>")
    if idx != -1:
        print(f"Context around first color:\n{content[idx-50:idx+50]}")

print("\n--- STRUCTURE ANALYSIS ---")
if "<Placemark>" in content and "<Style>" in content:
   if content.find("<Style>") > content.find("<Placemark>"):
       print("Styles appear to be INLINE (defined inside Placemarks).")
   else:
       print("Styles appear to be GLOBAL (defined at Document level).")
