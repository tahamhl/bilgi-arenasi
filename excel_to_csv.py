import pandas as pd

# Excel dosyasını oku
df = pd.read_excel('Kahoot_Soru_Bankasi_300_Soru.xlsx')

# CSV olarak kaydet
df.to_csv('sorular.csv', index=False, encoding='utf-8') 