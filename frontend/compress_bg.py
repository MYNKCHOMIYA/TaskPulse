from PIL import Image
import sys

img = Image.open("public/bg.png")
img.save("public/bg-desktop.webp", "WEBP", quality=75)
print("Done")
