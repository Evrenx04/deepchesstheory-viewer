// The privacy page (#/gizlilik): the KVKK notice (aydınlatma metni) in Turkish and the GDPR privacy notice in
// English, every text in one place (PRIVACY / PRIVACY_EN; the page picks one with L()).
// Placeholders in [brackets] are filled in before the site goes public.

/** The page's address: #/gizlilik. Not a study id. */
export const PRIVACY_ROUTE = "gizlilik";

/** The data controller (veri sorumlusu): a natural person until the company is founded. */
export const CONTROLLER = {
  name: "[Ad Soyad]",
  address: "[Posta adresi]",
  email: "contact@deepchesstheory.com",
};

export interface PrivacySection {
  title: string;
  paragraphs: string[];
  list?: string[];
}

export interface PrivacyText {
  link: string;
  title: string;
  updated: string;
  lead: string;
  sections: PrivacySection[];
}

export const PRIVACY: PrivacyText = {
  link: "Gizlilik",
  title: "Gizlilik ve kişisel veriler",
  updated: "Son güncelleme: 28 Ekim 2026",
  lead: "Bu metin, 6698 sayılı Kişisel Verilerin Korunması Kanunu (KVKK) 10. maddesi gereği hazırlanan aydınlatma metnidir. Kısaca: sitede hesap yok, ilerlemen yalnız kendi tarayıcında durur; senden aldığımız tek kişisel veri, istersen \"açılınca haber ver\" listesine yazdığın e-posta adresin.",
  sections: [
    {
      title: "Veri sorumlusu",
      paragraphs: [`${CONTROLLER.name}, ${CONTROLLER.address}. E-posta: ${CONTROLLER.email}`],
    },
    {
      title: "Hangi verileri, neden işliyoruz?",
      paragraphs: [],
      list: [
        "\"Açılınca haber ver\" listesi: e-posta adresin, kaydolduğun ve onayladığın tarih ve o sıradaki IP adresin (onayının kanıtı olarak). Amaç: kurs duyuruları, yani kurs açıldığında ve yeni kurslar çıktığında sana haber vermek. Hukuki sebep: formda verdiğin açık rıza (KVKK 5/1) ve ticari elektronik ileti onayı (6563 sayılı Kanun). Kayıttan sonra gelen e-postadaki bağlantıya tıklamadıkça listeye eklenmezsin.",
        "Site içindeki ilerlemen, ayarların ve tekrar kartların: yalnız kendi tarayıcında (localStorage) saklanır, bize gönderilmez. Tarayıcı verilerini silersen kaybolur.",
        "Ziyaret istatistikleri: Cloudflare Web Analytics. Çerez kullanmaz ve seni tanıyan bilgi toplamaz; yalnız toplu sayılar görürüz (sayfa görüntüleme, ülke, tarayıcı türü).",
        "Teknik kayıtlar: site Cloudflare üzerinden yayınlanır; Cloudflare güvenlik ve hizmetin çalışması için IP adresi gibi teknik bilgileri kısa süre işler. Hukuki sebep: meşru menfaat (KVKK 5/2-f).",
        "Bize e-posta yazarsan: e-posta adresin ve yazdıkların, yalnız cevap vermek için. Hukuki sebep: meşru menfaat (KVKK 5/2-f).",
      ],
    },
    {
      title: "Verileri kimlere aktarıyoruz?",
      paragraphs: [
        "Verilerini satmayız ve reklam için kullanmayız. Yalnız şu hizmet sağlayıcılar bizim adımıza işler:",
        "Bu sağlayıcılar verileri Türkiye dışında işler; aktarım KVKK 9. maddeye uygun yapılır.",
      ],
      list: [
        "MailerLite (Avrupa Birliği merkezli e-posta hizmeti): \"açılınca haber ver\" listesi ve listeye giden e-postalar.",
        "Cloudflare, Inc. (ABD): sitenin yayını, güvenliği, ziyaret istatistikleri ve iletişim adresine gelen e-postaların yönlendirilmesi.",
      ],
    },
    {
      title: "Ne kadar saklıyoruz?",
      paragraphs: [
        "Liste kaydın listeden çıkana kadar saklanır. Çıkınca e-posta adresin listeden silinir; yalnız sana yeniden e-posta gönderilmemesi için çıkış kaydı tutulabilir. E-posta yazışmaları konu kapandıktan sonra en çok bir yıl saklanır.",
      ],
    },
    {
      title: "Hakların",
      paragraphs: [
        `KVKK 11. madde gereği: verilerinin işlenip işlenmediğini öğrenme, işlendiyse bilgi isteme, amacını ve uygun kullanılıp kullanılmadığını öğrenme, aktarıldığı kişileri bilme, eksik ya da yanlışsa düzeltilmesini, silinmesini isteme, bu işlemlerin aktarılan kişilere bildirilmesini isteme, otomatik analizle aleyhine bir sonuç çıkmasına itiraz etme ve zararın giderilmesini isteme hakkın var. Başvurunu ${CONTROLLER.email} adresine ya da yukarıdaki posta adresine yaz; en geç 30 gün içinde ücretsiz cevap veririz. Kişisel Verileri Koruma Kurulu'na şikâyet hakkın da saklıdır.`,
        "Listeden istediğin an çıkabilirsin: her e-postanın altındaki \"abonelikten çık\" bağlantısına tıkla ya da bize yaz. 18 yaşından küçüksen listeye bir velinle birlikte kaydol.",
      ],
    },
  ],
};

export const PRIVACY_EN: PrivacyText = {
  link: "Privacy",
  title: "Privacy and personal data",
  updated: "Last updated: 28 October 2026",
  lead: "This notice explains how this site processes personal data under the EU General Data Protection Regulation (GDPR) and Turkish data protection law (KVKK). In short: there are no accounts, your progress stays in your own browser, and the only personal data we collect is your email address, if you choose to join the \"tell me when it opens\" list.",
  sections: [
    {
      title: "Who is responsible",
      paragraphs: [`The data controller is ${CONTROLLER.name}, ${CONTROLLER.address}. Email: ${CONTROLLER.email}`],
    },
    {
      title: "What we process and why",
      paragraphs: [],
      list: [
        "The \"tell me when it opens\" list: your email address, the time you signed up and confirmed, and your IP address at that time (as a record of your consent). Purpose: course announcements, that is, telling you when the course opens and when new courses come out. Legal basis: your consent (GDPR Art. 6(1)(a)). You are added to the list only after you click the link in the confirmation email.",
        "Your progress, settings and review cards on the site: stored only in your own browser (localStorage) and never sent to us. Clearing your browser data removes them.",
        "Visit statistics: Cloudflare Web Analytics. It uses no cookies and collects nothing that identifies you; we only see totals (page views, country, browser type).",
        "Technical logs: the site is served through Cloudflare, which processes technical data such as IP addresses for a short time to keep the service secure and running. Legal basis: our legitimate interest (Art. 6(1)(f)).",
        "If you email us: your address and your message, only to answer you. Legal basis: our legitimate interest (Art. 6(1)(f)).",
      ],
    },
    {
      title: "Who receives your data",
      paragraphs: [
        "We do not sell your data or use it for advertising. Only these service providers process it on our behalf:",
        "Cloudflare processes data in the United States; such transfers rely on safeguards recognised under the GDPR, such as the EU-US Data Privacy Framework or standard contractual clauses.",
      ],
      list: [
        "MailerLite (an email service based in the European Union): the \"tell me when it opens\" list and the emails sent to it.",
        "Cloudflare, Inc. (United States): hosting, security, visit statistics and forwarding of emails sent to our contact address.",
      ],
    },
    {
      title: "How long we keep it",
      paragraphs: [
        "Your list entry is kept until you unsubscribe. When you do, your address is removed from the list; we may keep a record of the unsubscription only so that you are not emailed again. Email correspondence is kept for at most one year after the matter is closed.",
      ],
    },
    {
      title: "Your rights",
      paragraphs: [
        `You have the right to access your data, to have it corrected or erased, to restrict or object to its processing, to data portability, and to withdraw your consent at any time without affecting what was done before. Write to ${CONTROLLER.email}; we answer within one month. You also have the right to lodge a complaint with the data protection authority of your country.`,
        "You can leave the list at any time: click the \"unsubscribe\" link at the bottom of any email or write to us. If you are under 16, join the list together with a parent.",
      ],
    },
  ],
};
