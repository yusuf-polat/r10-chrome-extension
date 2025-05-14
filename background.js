// Bildirim kontrolü için aralık (dakika cinsinden)
const CHECK_INTERVAL_MINUTES = 5
let securityToken = ""

// Eklenti yüklendiğinde çalışacak
chrome.runtime.onInstalled.addListener(() => {
  console.log("R10.net Bildirim Eklentisi yüklendi")

  // Düzenli kontrol için alarm kur
  chrome.alarms.create("checkNotifications", {
    periodInMinutes: CHECK_INTERVAL_MINUTES,
  })

  // İlk kontrol
  checkForNotifications()
})

// Alarm tetiklendiğinde bildirimleri kontrol et
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "checkNotifications") {
    checkForNotifications()
  }
})

// Bildirimleri kontrol et
async function checkForNotifications() {
  try {
    // Önce security token'ı al
    await getSecurityToken()

    // Token alındıysa bildirimleri kontrol et
    if (securityToken) {
      const notifications = await fetchNotifications()
      processNotifications(notifications)
    }
  } catch (error) {
    console.error("Bildirim kontrolü sırasında hata:", error)
  }
}

// Security token'ı al
async function getSecurityToken() {
  try {
    const response = await fetch("https://www.r10.net/")
    const html = await response.text()

    // SECURITYTOKEN'ı HTML içinden çıkar
    const tokenMatch = html.match(/var SECURITYTOKEN = "([^"]+)"/)

    if (tokenMatch && tokenMatch[1]) {
      securityToken = tokenMatch[1]
      console.log("Security token alındı:", securityToken)
      return securityToken
    } else {
      console.error("Security token bulunamadı")
      return null
    }
  } catch (error) {
    console.error("Security token alınırken hata:", error)
    return null
  }
}

// Bildirimleri getir
async function fetchNotifications() {
  try {
    const formData = new FormData()
    formData.append("do", "bildirimlerx")
    formData.append("detail", "1")
    formData.append("securitytoken", securityToken)

    const response = await fetch("https://www.r10.net/ajax.php?do=bildirimlerx&t=1", {
      method: "POST",
      body: formData,
    })

    const xmlText = await response.text()
    return parseNotificationsXml(xmlText)
  } catch (error) {
    console.error("Bildirimler alınırken hata:", error)
    return null
  }
}

// XML bildirimleri parse et
function parseNotificationsXml(xmlText) {
  const parser = new DOMParser()
  const xmlDoc = parser.parseFromString(xmlText, "text/xml")

  // Temel bilgileri çıkar
  const result = {
    ozelMesajKullanim: getXmlNodeValue(xmlDoc, "ozelMesajKullanim"),
    ozelMesajSayi: getXmlNodeValue(xmlDoc, "ozelMesajSayi"),
    okunmamisOzelMesajSayi: getXmlNodeValue(xmlDoc, "okunmamisOzelMesajSayi"),
    arkadaslikIstekSayi: getXmlNodeValue(xmlDoc, "arkadaslikIstekSayi"),
    bildirimSayi: getXmlNodeValue(xmlDoc, "bildirimSayi"),
    okunmamisBildirimSayi: getXmlNodeValue(xmlDoc, "okunmamisBildirimSayi"),
    ozelMesajlar: getXmlNodeCData(xmlDoc, "ozelMesajlar"),
    bildirimler: getXmlNodeCData(xmlDoc, "bildirimler"),
  }

  return result
}

// XML node değerini al
function getXmlNodeValue(xmlDoc, nodeName) {
  const node = xmlDoc.getElementsByTagName(nodeName)[0]
  return node ? Number.parseInt(node.textContent) || 0 : 0
}

// XML CDATA içeriğini al
function getXmlNodeCData(xmlDoc, nodeName) {
  const node = xmlDoc.getElementsByTagName(nodeName)[0]
  return node ? node.textContent : ""
}

// Bildirimleri işle ve göster
async function processNotifications(data) {
  if (!data) return

  // Önceki bildirim sayılarını al
  const prevData = await chrome.storage.local.get([
    "okunmamisOzelMesajSayi",
    "arkadaslikIstekSayi",
    "okunmamisBildirimSayi",
  ])

  // Yeni bildirim sayıları
  const newPrivateMessages = data.okunmamisOzelMesajSayi - (prevData.okunmamisOzelMesajSayi || 0)
  const newFriendRequests = data.arkadaslikIstekSayi - (prevData.arkadaslikIstekSayi || 0)
  const newNotifications = data.okunmamisBildirimSayi - (prevData.okunmamisBildirimSayi || 0)

  // Yeni bildirim varsa göster
  if (newPrivateMessages > 0) {
    showNotification("Yeni Özel Mesaj", `${newPrivateMessages} yeni özel mesajınız var.`)
  }

  if (newFriendRequests > 0) {
    showNotification("Yeni Arkadaşlık İsteği", `${newFriendRequests} yeni arkadaşlık isteğiniz var.`)
  }

  if (newNotifications > 0) {
    showNotification("Yeni Bildirim", `${newNotifications} yeni bildiriminiz var.`)
  }

  // Bildirim verilerini sakla
  await chrome.storage.local.set({
    okunmamisOzelMesajSayi: data.okunmamisOzelMesajSayi,
    arkadaslikIstekSayi: data.arkadaslikIstekSayi,
    okunmamisBildirimSayi: data.okunmamisBildirimSayi,
    lastNotificationData: data,
    lastCheckTime: new Date().toISOString(),
  })

  // Badge'i güncelle
  updateBadge(data)
}

// Tarayıcı bildirimi göster
function showNotification(title, message) {
  chrome.notifications.create({
    type: "basic",
    iconUrl: "images/icon128.png",
    title: title,
    message: message,
    priority: 2,
  })
}

// Eklenti badge'ini güncelle
function updateBadge(data) {
  const totalUnread = data.okunmamisOzelMesajSayi + data.arkadaslikIstekSayi + data.okunmamisBildirimSayi

  if (totalUnread > 0) {
    chrome.action.setBadgeText({ text: totalUnread.toString() })
    chrome.action.setBadgeBackgroundColor({ color: "#FF5722" })
  } else {
    chrome.action.setBadgeText({ text: "" })
  }
}
