from PIL import Image

def make_square(im, min_size=512, fill_color=(255, 255, 255, 0)):
    x, y = im.size
    size = max(min_size, x, y)
    new_im = Image.new('RGBA', (size, size), fill_color)
    new_im.paste(im, (int((size - x) / 2), int((size - y) / 2)))
    return new_im

try:
    img = Image.open('C:/Users/H P/.gemini/antigravity/brain/e5e12afb-5ef7-4fca-97bd-e9aa22d3aee1/media__1776263598516.png').convert('RGBA')
    sq = make_square(img)
    
    # Generate exact sizes
    sq_192 = sq.resize((192, 192), Image.Resampling.LANCZOS)
    sq_512 = sq.resize((512, 512), Image.Resampling.LANCZOS)
    
    # Save files
    sq_192.save('public/icons/icon-192.png')
    sq_512.save('public/icons/icon-512.png')
    sq_512.save('src/app/icon.png')
    sq_512.save('src/app/apple-icon.png')
    sq_512.save('public/favicon.png')
    
    print("SUCCESS: 1:1 Square icons generated successfully.")
except Exception as e:
    print(f"ERROR: {e}")
