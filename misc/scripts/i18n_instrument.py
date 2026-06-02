#!/usr/bin/env python3
"""
Instruments HTML files with data-i18n attributes.
Finds text nodes containing Cyrillic characters and adds data-i18n keys.
Also extracts translation keys for locale JSON files.
"""
import json
import re
import sys
from pathlib import Path
from bs4 import BeautifulSoup, NavigableString

CYRILLIC_RE = re.compile(r'[А-Яа-яЁё]')
SKIP_TAGS = {'script', 'style', 'code', 'pre', 'iframe', 'noscript'}
TEXT_ATTRS = {'placeholder', 'title', 'alt', 'aria-label'}

def slugify(text):
    text = re.sub(r'[^\w\s-]', '', text.lower())
    text = re.sub(r'[-\s]+', '_', text.strip())
    return text.strip('_')[:40]

def get_context_key(element, text):
    parts = []
    parent_id = ''
    for p in [element] + list(element.parents):
        if p.get('id'):
            parent_id = slugify(p.get('id'))
            break
    parent_cls = ''
    if not parent_id:
        for p in [element] + list(element.parents):
            cls = p.get('class')
            if cls:
                parent_cls = slugify(cls[0])
                break
    tag = element.name
    text_slug = slugify(text)
    if parent_id:
        prefix = parent_id
    elif parent_cls:
        prefix = parent_cls
    else:
        prefix = tag
    key = f"{prefix}.{text_slug}"
    key = re.sub(r'_+', '_', key)
    return key

def instrument_html(filepath):
    filepath = Path(filepath)
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    soup = BeautifulSoup(content, 'html.parser')
    translations = {}
    inline_tags = {'span', 'strong', 'b', 'em', 'i', 'u', 'small', 'br'}
    
    def process_element(element):
        if element.name in SKIP_TAGS:
            return
        if element.get('data-i18n'):
            return
        if element.name in ['meta', 'link', 'base']:
            return
        
        text = element.get_text(strip=True)
        if not text or not CYRILLIC_RE.search(text):
            return
        
        has_element_children = any(hasattr(c, 'name') and c.name for c in element.children)
        
        if has_element_children:
            complex_children = [c for c in element.children 
                              if hasattr(c, 'name') and c.name and c.name not in inline_tags]
            if complex_children:
                for child in element.children:
                    if hasattr(child, 'name') and child.name:
                        process_element(child)
                return
            
            child_texts = []
            for child in element.children:
                if hasattr(child, 'name') and child.name and child.name not in inline_tags:
                    ct = child.get_text(strip=True)
                    if ct and CYRILLIC_RE.search(ct):
                        child_texts.append(ct)
            
            direct_text = ''.join(str(c) for c in element.children 
                                 if isinstance(c, NavigableString)).strip()
            if child_texts and direct_text and CYRILLIC_RE.search(direct_text):
                for child in element.children:
                    if hasattr(child, 'name') and child.name:
                        process_element(child)
                return
            if child_texts:
                for child in element.children:
                    if hasattr(child, 'name') and child.name:
                        process_element(child)
                return
        
        key = get_context_key(element, text)
        base_key = key
        counter = 1
        while key in translations and translations[key] != text:
            key = f"{base_key}_{counter}"
            counter += 1
        
        element['data-i18n'] = key
        translations[key] = text
    
    for elem in list(soup.descendants):
        if hasattr(elem, 'name') and elem.name:
            process_element(elem)
    
    for elem in soup.find_all():
        if elem.name in SKIP_TAGS:
            continue
        for attr in TEXT_ATTRS:
            val = elem.get(attr)
            if val and CYRILLIC_RE.search(val) and not elem.get(f'data-i18n-{attr}'):
                key = get_context_key(elem, val)
                base_key = key
                counter = 1
                while key in translations and translations[key] != val:
                    key = f"{base_key}_{counter}"
                    counter += 1
                elem[f'data-i18n-{attr}'] = key
                translations[key] = val
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(str(soup))
    
    return translations

def merge_into_locales(translations, locales_dir):
    locales_dir = Path(locales_dir)
    for lang in ['ru', 'en', 'kz']:
        filepath = locales_dir / f"{lang}.json"
        if filepath.exists():
            with open(filepath, 'r', encoding='utf-8') as f:
                data = json.load(f)
        else:
            data = {}
        
        flat = flatten_dict(data)
        
        for key, ru_text in translations.items():
            if key not in flat:
                flat[key] = ru_text if lang == 'ru' else ''
        
        data = unflatten_dict(flat)
        
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

def flatten_dict(d, parent_key=''):
    items = {}
    for k, v in d.items():
        new_key = f"{parent_key}.{k}" if parent_key else k
        if isinstance(v, dict):
            items.update(flatten_dict(v, new_key))
        else:
            items[new_key] = v
    return items

def unflatten_dict(d):
    result = {}
    for key, value in d.items():
        parts = key.split('.')
        target = result
        for part in parts[:-1]:
            if part not in target:
                target[part] = {}
            target = target[part]
        target[parts[-1]] = value
    return result

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python i18n_instrument.py <html-file> [html-file2 ...]")
        sys.exit(1)
    
    all_translations = {}
    for html_file in sys.argv[1:]:
        print(f"Processing {html_file}...")
        trans = instrument_html(html_file)
        all_translations.update(trans)
        print(f"  Added {len(trans)} translation keys")
    
    if all_translations:
        merge_into_locales(all_translations, 'locales')
        print(f"\nTotal new keys: {len(all_translations)}")
        print("Updated locales/ru.json, en.json, kz.json")
