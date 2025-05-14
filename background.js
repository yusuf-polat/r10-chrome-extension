// Bildirim kontrolü ve token yenileme için aralıklar
const CHECK_INTERVAL_SECONDS = 3 // 3 saniyede bir bildirim kontrolü
const TOKEN_REFRESH_MINUTES = 1 // 1 dakikada bir token yenileme
let securityToken = ""
let isBlocked = false
let lastTokenRefresh = 0

// Eklenti yüklendiğinde çalışacak
chrome.runtime.onInstalled.addListener(() => {
  console.log("R10.net Bildirim Eklentisi yüklendi")

  // Bildirim kontrolü için alarm kur (3 saniyede bir)
  chrome.alarms.create("checkNotifications", {
    periodInMinutes: CHECK_INTERVAL_SECONDS / 60,
  })

  // Token yenileme için alarm kur (1 dakikada bir)
  chrome.alarms.create("refreshToken", {
    periodInMinutes: TOKEN_REFRESH_MINUTES,
  })

  // İlk token alımı
  refreshSecurityToken()
})

// Alarm tetiklendiğinde yapılacak işlemler
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "checkNotifications") {
    checkForNotifications()
  } else if (alarm.name === "refreshToken") {
    refreshSecurityToken()
  }
})

// Security token'ı yenile
async function refreshSecurityToken() {
  try {
    // Eğer daha önce engellendiysek, tekrar denemeden önce bir süre bekleyelim
    if (isBlocked) {
      const lastBlockTime = await chrome.storage.local.get("lastBlockTime")
      const now = Date.now()
      // 1 saat geçmediyse tekrar deneme
      if (lastBlockTime.lastBlockTime && now - lastBlockTime.lastBlockTime < 3600000) {
        console.log("Site erişimi engellendi. Daha sonra tekrar denenecek.")
        return
      }
    }

    const response = await fetch("https://www.r10.net/", {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
    })

    if (!response.ok) {
      if (response.status === 403 || response.status === 1005) {
        isBlocked = true
        await chrome.storage.local.set({ lastBlockTime: Date.now() })
        throw new Error("Access denied by Cloudflare")
      }
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const html = await response.text()

    // SECURITYTOKEN'ı HTML içinden çıkar
    const tokenMatch = html.match(/var SECURITYTOKEN = "([^"]+)"/)

    if (tokenMatch && tokenMatch[1]) {
      securityToken = tokenMatch[1]
      lastTokenRefresh = Date.now()
      console.log("Security token yenilendi:", securityToken)

      // Token'ı storage'a kaydet
      await chrome.storage.local.set({
        securityToken: securityToken,
        lastTokenRefresh: lastTokenRefresh,
      })

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

// Bildirimleri kontrol et
async function checkForNotifications() {
  try {
    // Token yoksa veya çok eskiyse yenile
    if (!securityToken) {
      // Storage'dan token'ı kontrol et
      const data = await chrome.storage.local.get(["securityToken", "lastTokenRefresh"])
      if (data.securityToken) {
        securityToken = data.securityToken
        lastTokenRefresh = data.lastTokenRefresh || 0
        console.log("Token storage'dan alındı:", securityToken)
      } else {
        // Token hiç yoksa yenile
        await refreshSecurityToken()
      }
    }

    // Token alındıysa bildirimleri kontrol et
    if (securityToken) {
      const notifications = await fetchNotifications()
      if (notifications) {
        isBlocked = false
        processNotifications(notifications)
      }
    }
  } catch (error) {
    console.error("Bildirim kontrolü sırasında hata:", error)
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
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
    })

    if (!response.ok) {
      if (response.status === 403 || response.status === 1005) {
        isBlocked = true
        await chrome.storage.local.set({ lastBlockTime: Date.now() })
        throw new Error("Access denied by Cloudflare")
      }
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const xmlText = await response.text()
    return parseNotificationsXml(xmlText)
  } catch (error) {
    console.error("Bildirimler alınırken hata:", error)
    return null
  }
}

// Simple XML parsing without DOMParser (which isn't available in service workers)
function parseNotificationsXml(xmlText) {
  // Simple XML parsing without DOMParser (which isn't available in service workers)
  const result = {
    ozelMesajKullanim: 0,
    ozelMesajSayi: 0,
    okunmamisOzelMesajSayi: 0,
    arkadaslikIstekSayi: 0,
    bildirimSayi: 0,
    okunmamisBildirimSayi: 0,
    ozelMesajlar: "",
    bildirimler: "",
  }

  // Extract values using regex
  const getTagContent = (xml, tagName) => {
    const regex = new RegExp(`<${tagName}>([^<]*)</${tagName}>`, "i")
    const match = xml.match(regex)
    return match ? match[1] : ""
  }

  // Extract CDATA content
  const getCDataContent = (xml, tagName) => {
    const regex = new RegExp(`<${tagName}><!\\[CDATA\\[(.*?)\\]\\]></${tagName}>`, "s")
    const match = xml.match(regex)
    return match ? match[1] : ""
  }

  // Extract numeric values
  result.ozelMesajKullanim = Number.parseInt(getTagContent(xmlText, "ozelMesajKullanim")) || 0
  result.ozelMesajSayi = Number.parseInt(getTagContent(xmlText, "ozelMesajSayi")) || 0
  result.okunmamisOzelMesajSayi = Number.parseInt(getTagContent(xmlText, "okunmamisOzelMesajSayi")) || 0
  result.arkadaslikIstekSayi = Number.parseInt(getTagContent(xmlText, "arkadaslikIstekSayi")) || 0
  result.bildirimSayi = Number.parseInt(getTagContent(xmlText, "bildirimSayi")) || 0
  result.okunmamisBildirimSayi = Number.parseInt(getTagContent(xmlText, "okunmamisBildirimSayi")) || 0

  // Extract CDATA sections
  result.ozelMesajlar = getCDataContent(xmlText, "ozelMesajlar")
  result.bildirimler = getCDataContent(xmlText, "bildirimler")

  return result
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

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "checkNotifications") {
    checkForNotifications()
      .then(() => sendResponse({ success: true }))
      .catch((error) => sendResponse({ success: false, error: error.message }))
    return true // Indicates async response
  } else if (message.action === "getTokenInfo") {
    sendResponse({
      token: securityToken,
      lastRefresh: lastTokenRefresh,
      nextRefresh: lastTokenRefresh + TOKEN_REFRESH_MINUTES * 60 * 1000,
    })
    return true
  }
})
