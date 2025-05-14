// DOM elementleri
const refreshBtn = document.getElementById("refreshBtn")
const pmCount = document.getElementById("pmCount")
const friendCount = document.getElementById("friendCount")
const notifyCount = document.getElementById("notifyCount")
const notificationList = document.getElementById("notificationList")
const loadingIndicator = document.getElementById("loadingIndicator")
const emptyState = document.getElementById("emptyState")
const lastCheckTime = document.getElementById("lastCheckTime")
const tabAll = document.getElementById("tabAll")
const tabPm = document.getElementById("tabPm")
const tabNotify = document.getElementById("tabNotify")
const tokenStatus = document.getElementById("tokenStatus")

// Aktif sekme
let activeTab = "all"

// Sayfa yüklendiğinde
document.addEventListener("DOMContentLoaded", () => {
  // Bildirimleri yükle
  loadNotifications()

  // Yenile butonuna tıklandığında
  refreshBtn.addEventListener("click", () => {
    refreshNotifications()
  })

  // Tab butonlarına tıklandığında
  tabAll.addEventListener("click", () => switchTab("all"))
  tabPm.addEventListener("click", () => switchTab("pm"))
  tabNotify.addEventListener("click", () => switchTab("notify"))
})

// Bildirimleri yükle
async function loadNotifications() {
  showLoading(true)

  try {
    // Storage'dan verileri al
    const data = await chrome.storage.local.get(["lastNotificationData", "lastCheckTime"])

    if (data.lastNotificationData) {
      updateUI(data.lastNotificationData)

      if (data.lastCheckTime) {
        const checkTime = new Date(data.lastCheckTime)
        lastCheckTime.textContent = formatDate(checkTime)
      }
    } else {
      // Veri yoksa yenile
      await refreshNotifications()
    }
  } catch (error) {
    console.error("Bildirimler yüklenirken hata:", error)
  } finally {
    // Token bilgisini al
    chrome.runtime.sendMessage({ action: "getTokenInfo" }, (response) => {
      if (response) {
        const now = Date.now()
        const nextRefresh = new Date(response.nextRefresh)
        const timeUntilRefresh = Math.max(0, Math.floor((response.nextRefresh - now) / 1000))

        if (response.token) {
          tokenStatus.textContent = `Aktif (${timeUntilRefresh} sn sonra yenilenecek)`
          tokenStatus.classList.add("text-green-600")
          tokenStatus.classList.remove("text-red-600")
        } else {
          tokenStatus.textContent = "Token alınamadı"
          tokenStatus.classList.add("text-red-600")
          tokenStatus.classList.remove("text-green-600")
        }
      }
    })
    showLoading(false)
  }
}

// Bildirimleri yenile
async function refreshNotifications() {
  showLoading(true)

  try {
    // Background script'e bildirim kontrolü mesajı gönder
    chrome.runtime.sendMessage({ action: "checkNotifications" }, async (response) => {
      // Storage'dan güncel verileri al
      const data = await chrome.storage.local.get(["lastNotificationData", "lastCheckTime"])

      if (data.lastNotificationData) {
        updateUI(data.lastNotificationData)

        if (data.lastCheckTime) {
          const checkTime = new Date(data.lastCheckTime)
          lastCheckTime.textContent = formatDate(checkTime)
        }
      }

      showLoading(false)
    })
  } catch (error) {
    console.error("Bildirimler yenilenirken hata:", error)
    showLoading(false)
  }
}

// UI'ı güncelle
function updateUI(data) {
  // Sayaçları güncelle
  pmCount.textContent = data.okunmamisOzelMesajSayi || "0"
  friendCount.textContent = data.arkadaslikIstekSayi || "0"
  notifyCount.textContent = data.okunmamisBildirimSayi || "0"

  // Bildirimleri göster
  renderNotifications(data)
}

// Bildirimleri render et
function renderNotifications(data) {
  notificationList.innerHTML = ""

  // HTML parser
  const parser = new DOMParser()

  // Özel mesajları parse et
  const pmItems = []
  if (data.ozelMesajlar) {
    const pmDoc = parser.parseFromString(data.ozelMesajlar, "text/html")
    const items = pmDoc.querySelectorAll("li")

    items.forEach((item) => {
      const link = item.querySelector("a")
      const title = item.querySelector(".title")?.textContent || ""
      const user = item.querySelector(".user")?.textContent || ""
      const date = item.querySelector(".date")?.textContent || ""
      const avatar = item.querySelector(".avatar img")?.src || ""
      const url = link?.href || ""

      pmItems.push({ type: "pm", title, user, date, avatar, url })
    })
  }

  // Bildirimleri parse et
  const notifyItems = []
  if (data.bildirimler) {
    const notifyDoc = parser.parseFromString(data.bildirimler, "text/html")
    const items = notifyDoc.querySelectorAll("li")

    items.forEach((item) => {
      const link = item.querySelector("a")
      const notify = item.querySelector(".notify")?.innerHTML || ""
      const date = item.querySelector(".date")?.textContent || ""
      const avatar = item.querySelector(".avatar img")?.src || ""
      const url = link?.href || ""
      const dataId = item.getAttribute("data-id") || ""
      const dataType = item.getAttribute("data-type") || ""

      notifyItems.push({ type: "notify", notify, date, avatar, url, dataId, dataType })
    })
  }

  // Aktif sekmeye göre göster
  let itemsToShow = []

  if (activeTab === "all") {
    itemsToShow = [...pmItems, ...notifyItems]
  } else if (activeTab === "pm") {
    itemsToShow = pmItems
  } else if (activeTab === "notify") {
    itemsToShow = notifyItems
  }

  // Boş durum kontrolü
  if (itemsToShow.length === 0) {
    emptyState.classList.remove("hidden")
    return
  } else {
    emptyState.classList.add("hidden")
  }

  // Bildirimleri listele
  itemsToShow.forEach((item) => {
    const element = document.createElement("div")
    element.className = "notification-item p-3 hover:bg-gray-50"

    if (item.type === "pm") {
      element.innerHTML = `
        <a href="${item.url}" target="_blank" class="flex items-start">
          <img src="${item.avatar}" alt="${item.user}" class="w-10 h-10 rounded-full mr-3">
          <div class="flex-1">
            <div class="font-medium text-gray-900">${item.title}</div>
            <div class="text-sm text-gray-600">${item.user}</div>
            <div class="text-xs text-gray-500 mt-1">${item.date}</div>
          </div>
        </a>
      `
    } else {
      element.innerHTML = `
        <a href="${item.url}" target="_blank" class="flex items-start">
          <img src="${item.avatar}" alt="Bildirim" class="w-10 h-10 rounded-full mr-3">
          <div class="flex-1">
            <div class="text-sm text-gray-800">${item.notify}</div>
            <div class="text-xs text-gray-500 mt-1">${item.date}</div>
          </div>
        </a>
      `
    }

    notificationList.appendChild(element)
  })
}

// Sekme değiştir
function switchTab(tab) {
  activeTab = tab

  // Tab butonlarını güncelle
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.classList.remove("text-blue-600", "border-b-2", "border-blue-600")
    btn.classList.add("text-gray-600")
  })

  // Aktif tab'ı vurgula
  if (tab === "all") {
    tabAll.classList.add("text-blue-600", "border-b-2", "border-blue-600")
    tabAll.classList.remove("text-gray-600")
  } else if (tab === "pm") {
    tabPm.classList.add("text-blue-600", "border-b-2", "border-blue-600")
    tabPm.classList.remove("text-gray-600")
  } else if (tab === "notify") {
    tabNotify.classList.add("text-blue-600", "border-b-2", "border-blue-600")
    tabNotify.classList.remove("text-gray-600")
  }

  // Bildirimleri yeniden render et
  chrome.storage.local.get("lastNotificationData", (data) => {
    if (data.lastNotificationData) {
      renderNotifications(data.lastNotificationData)
    }
  })
}

// Yükleniyor göstergesini göster/gizle
function showLoading(show) {
  if (show) {
    loadingIndicator.classList.remove("hidden")
    notificationList.classList.add("hidden")
  } else {
    loadingIndicator.classList.add("hidden")
    notificationList.classList.remove("hidden")
  }
}

// Tarih formatla
function formatDate(date) {
  return date.toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}
