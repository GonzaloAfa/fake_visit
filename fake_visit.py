import codecs
import os
import uuid

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options as ChromeOptions


TITLE_NOTE = "plataforma"

BASE_URL = 'https://www.lun.com'
PAGES_ENDPOINT = 'pages/LUNHomepage.aspx'
DATE = '18-05-2026 0:00:00'

TOTAL_FAKE_VISIT = 1000

COOKIES = [
    'LUNUniqueVisitor_New',
    'LUNNewsUniqueVisitor',
    '__auc',
    '_gid',
    '__asc',
    '_ga'
]


def set_output(name, value):
    try:
        with open(os.environ['GITHUB_OUTPUT'], 'a') as fh:
            print(f'{name}={value}', file=fh)
    except:
        print(value)

def generate_url():
    '''generate_url'''
    return f"{BASE_URL}/{PAGES_ENDPOINT}?xp={DATE}&BodyID=0&xp={DATE}"


def save_file(driver):
    '''save_file'''
    content = driver.page_source

    file = codecs.open("lun.html", "w", "utf−8")
    file.write(content)


def fake_visit(driver):
    '''fake_visit'''
    driver.get(generate_url())

    note_id = find_node_id(driver)

    # save_file(driver)

    if not note_id:
        set_output("error", "Ups! No encontramos la nota, pero esta es la url: " + generate_url())

    element = driver.find_element(By.ID, note_id)
    driver.execute_script("arguments[0].click();", element)


def clear_cookies(driver):
    '''clear_cookies'''
    for cookie in COOKIES:
        driver.delete_cookie(cookie)

def find_node_id(driver):
    ''' check '''
    elements = driver.find_elements(By.ID, 'contenedor_nota_ranking')

    for element in elements:
        elements_tag_a = element.find_elements(By.TAG_NAME, 'a')

        for tag_a in elements_tag_a:
            name = tag_a.get_property('name')

            if TITLE_NOTE in name:
                return tag_a.get_property('id')
    return None

def main():
    '''main'''
    
    chrome_options = ChromeOptions()
    chrome_options.add_argument("--headless=new")

    driver = webdriver.Chrome(options=chrome_options)
    driver.accept_untrusted_certs = True

    print ("Keywords: " + TITLE_NOTE)

    for item in range(TOTAL_FAKE_VISIT):
        try:
            fake_visit(driver)
            clear_cookies(driver)

            if item % 10 == 0:
                set_output("items", str(item))

        except Exception:
            set_output("error", "Tuvimos un error en una de las peticiones")

    driver.quit()


if __name__ == '__main__':
    set_output("start", "welcome to fake visit")
    main()
