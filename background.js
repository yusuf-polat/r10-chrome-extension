// Bildirim kontrolü ve token yenileme için aralıklar
const CHECK_INTERVAL_SECONDS = 20 // 20 saniyede bir bildirim kontrolü
const TOKEN_REFRESH_MINUTES = 1 // 1 dakikada bir token yenileme
let securityToken = ""
let isBlocked = false
let lastTokenRefresh = 0
let cookies = ""
const userAgent = navigator.userAgent // Tarayıcının user-agent'ını al

// Eklenti yüklendiğinde çalışacak
chrome.runtime.onInstalled.addListener(() => {
  console.log("R10.net Bildirim Eklentisi yüklendi")
  console.log("Kullanılan User-Agent:", userAgent)

  // Bildirim kontrolü için alarm kur (20 saniyede bir)
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

// Cookie'leri al
async function getCookies() {
  try {
    // Chrome extension API kullanarak r10.net için tüm cookie'leri al
    const r10Cookies = await chrome.cookies.getAll({ domain: "r10.net" })

    if (r10Cookies && r10Cookies.length > 0) {
      // Cookie'leri string formatına dönüştür
      cookies = r10Cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ")
      console.log("Cookies alındı")
      return cookies
    } else {
      console.error("R10.net için cookie bulunamadı")
      return ""
    }
  } catch (error) {
    console.error("Cookie'ler alınırken hata:", error)
    return ""
  }
}

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

    // Önce cookie'leri al
    await getCookies()

    const response = await fetch("https://www.r10.net/", {
      headers: {
        "User-Agent": userAgent,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
        "Accept-Language": "tr",
        "Sec-Ch-Ua": '"Chromium";v="136", "Google Chrome";v="136", "Not.A/Brand";v="99"',
        "Sec-Ch-Ua-Mobile": "?0",
        "Sec-Ch-Ua-Platform": '"Windows"',
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
        Cookie: cookies,
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

    // Cookie'leri kontrol et
    if (!cookies) {
      await getCookies()
    }

    // Token alındıysa bildirimleri kontrol et
    if (securityToken && cookies) {
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
    // URL-encoded form data oluştur
    const formData = new URLSearchParams()
    formData.append("do", "bildirimlerx")
    formData.append("detail", "1")
    formData.append("securitytoken", securityToken)

    const response = await fetch("https://www.r10.net/ajax.php?do=bildirimlerx&t=1", {
      method: "POST",
      headers: {
        Accept: "*/*",
        "Accept-Language": "tr",
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        Origin: "https://www.r10.net",
        Referer: "https://www.r10.net/",
        "Sec-Ch-Ua": '"Chromium";v="136", "Google Chrome";v="136", "Not.A/Brand";v="99"',
        "Sec-Ch-Ua-Mobile": "?0",
        "Sec-Ch-Ua-Platform": '"Windows"',
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-origin",
        "User-Agent": userAgent,
        "X-Requested-With": "XMLHttpRequest",
        Cookie: cookies,
      },
      body: formData.toString(),
    })

    if (!response.ok) {
      if (response.status === 403 || response.status === 1005) {
        isBlocked = true
        await chrome.storage.local.set({ lastBlockTime: Date.now() })
        throw new Error("Access denied by Cloudflare")
      }
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    // Get the response as ArrayBuffer
    const buffer = await response.arrayBuffer()
    // Convert from Windows-1254 to UTF-8
    const decoder = new TextDecoder('windows-1254')
    const xmlText = decoder.decode(buffer)
    
    // Remove the windows-1254 encoding declaration and replace with UTF-8
    const xmlTextFixed = xmlText.replace('encoding="windows-1254"', 'encoding="UTF-8"')
    
    return parseNotificationsXml(xmlTextFixed)
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

  // Fix links in notifications and private messages
  if (data.bildirimler) {
    data.bildirimler = fixNotificationLinks(data.bildirimler)
  }
  if (data.ozelMesajlar) {
    data.ozelMesajlar = fixNotificationLinks(data.ozelMesajlar)
  }

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

// Add this new helper function after processNotifications
function fixNotificationLinks(html) {
  if (!html) return html

  // Regular expression to find links
  const linkRegex = /href="([^"]+)"/g
  
  return html.replace(linkRegex, (match, url) => {
    // Skip if already has full URL
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return match
    }
    
    // Skip if already starts with r10.net
    if (url.startsWith('r10.net') || url.startsWith('www.r10.net')) {
      return match
    }
    
    // Add base URL to relative links
    const baseUrl = 'https://www.r10.net/'
    const fixedUrl = url.startsWith('/') ? baseUrl + url.slice(1) : baseUrl + url
    return `href="${fixedUrl}"`
  })
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
      userAgent: userAgent,
    })
    return true
  }
})
