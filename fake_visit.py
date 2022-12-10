import codecs

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.firefox.options import Options

TITLE_NOTE = "Consumer Reports"

BASE_URL = 'https://www.lun.com'
PAGES_ENDPOINT = 'pages/LUNHomepage.aspx'
DATE = '28-11-2022 0:00:00'

TOTAL_FAKE_VISIT = 10000

COOKIES = [
    'LUNUniqueVisitor_New',
    'LUNNewsUniqueVisitor',
    '__auc',
    '_gid',
    '__asc',
    '_ga'
]


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

    if not note_id:
        exit("Ups! No encontramos la nota, pero esta es la url: " + generate_url())

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

    options = Options()
    options.add_argument('--headless')

    driver = webdriver.Firefox(executable_path='geckodriver', options=options)
    driver.accept_untrusted_certs = True

    print ("Keywords: "+TITLE_NOTE)

    for item in range(TOTAL_FAKE_VISIT):
        try:
            fake_visit(driver)
            clear_cookies(driver)

            if item % 10 == 0:
                print(item)

        except Exception:
            print("Tuvimos un error en una de las peticiones")

    driver.quit()


if __name__ == '__main__':
    main()
