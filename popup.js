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
const userAgentInfo = document.getElementById("userAgentInfo")
const themeToggle = document.getElementById("themeToggle")

// Aktif sekme
let activeTab = "all"

// Sayfa yüklendiğinde
document.addEventListener("DOMContentLoaded", () => {
  // Tema ayarını kontrol et
  checkThemePreference()

  // Bildirimleri yükle
  loadNotifications()

  // Yenile butonuna tıklandığında
  refreshBtn.addEventListener("click", () => {
    refreshNotifications()
    // Yenileme animasyonu
    refreshBtn.classList.add("animate-spin")
    setTimeout(() => {
      refreshBtn.classList.remove("animate-spin")
    }, 1000)
  })

  // Tab butonlarına tıklandığında
  tabAll.addEventListener("click", () => switchTab("all"))
  tabPm.addEventListener("click", () => switchTab("pm"))
  tabNotify.addEventListener("click", () => switchTab("notify"))

  // Tema değiştirme
  themeToggle.addEventListener("click", toggleTheme)
})

// Tema tercihini kontrol et
function checkThemePreference() {
  chrome.storage.local.get("darkMode", (data) => {
    if (data.darkMode) {
      document.documentElement.classList.add("dark")
      updateThemeIcon(true)
    } else {
      document.documentElement.classList.remove("dark")
      updateThemeIcon(false)
    }
  })
}

// Tema değiştir
function toggleTheme() {
  const isDarkMode = document.documentElement.classList.toggle("dark")
  chrome.storage.local.set({ darkMode: isDarkMode })
  updateThemeIcon(isDarkMode)
}

// Tema ikonunu güncelle
function updateThemeIcon(isDarkMode) {
  if (isDarkMode) {
    themeToggle.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    `
  } else {
    themeToggle.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
      </svg>
    `
  }
}

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
    showError("Bildirimler yüklenirken bir hata oluştu.")
  } finally {
    // Token bilgisini al
    chrome.runtime.sendMessage({ action: "getTokenInfo" }, (response) => {
      if (response) {
        const now = Date.now()
        const nextRefresh = new Date(response.nextRefresh)
        const timeUntilRefresh = Math.max(0, Math.floor((response.nextRefresh - now) / 1000))

        if (response.token) {
          tokenStatus.textContent = `Aktif (${timeUntilRefresh} sn)`
          tokenStatus.classList.add("text-green-600", "dark:text-green-400")
          tokenStatus.classList.remove("text-red-600", "dark:text-red-400")

          // User-Agent bilgisini ekle
          if (response.userAgent) {
            userAgentInfo.textContent = `${response.userAgent}`
          }
        } else {
          tokenStatus.textContent = "Token alınamadı"
          tokenStatus.classList.add("text-red-600", "dark:text-red-400")
          tokenStatus.classList.remove("text-green-600", "dark:text-green-400")
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
    showError("Bildirimler yenilenirken bir hata oluştu.")
    showLoading(false)
  }
}

// UI'ı güncelle
function updateUI(data) {
  // Sayaçları güncelle
  updateCounter(pmCount, data.okunmamisOzelMesajSayi || 0)
  updateCounter(friendCount, data.arkadaslikIstekSayi || 0)
  updateCounter(notifyCount, data.okunmamisBildirimSayi || 0)

  // Bildirimleri göster
  renderNotifications(data)
}

// Sayaç animasyonu ile güncelle
function updateCounter(element, value) {
  // Mevcut değeri al
  const currentValue = Number.parseInt(element.textContent) || 0

  // Değer değiştiyse animasyon ekle
  if (currentValue !== value) {
    element.classList.add("badge-pulse")
    setTimeout(() => {
      element.classList.remove("badge-pulse")
    }, 2000)
  }

  element.textContent = value.toString()
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
    
    // Tarihleri parse edip sıralama yap
    itemsToShow.sort((a, b) => {
      const dateA = parseTurkishDate(a.date)
      const dateB = parseTurkishDate(b.date)
      return dateB - dateA // Yeniden eskiye sırala
    })
  } else if (activeTab === "pm") {
    itemsToShow = pmItems
  } else if (activeTab === "notify") {
    itemsToShow = notifyItems
  }

  // Boş durum kontrolü
  if (itemsToShow.length === 0) {
    emptyState.classList.remove("hidden")
    notificationList.classList.add("hidden")
    return
  } else {
    emptyState.classList.add("hidden")
    notificationList.classList.remove("hidden")
  }

  // Bildirimleri listele
  itemsToShow.forEach((item, index) => {
    const element = document.createElement("div")
    element.className = `notification-item p-4 hover:bg-gray-50 dark:hover:bg-gray-700 slide-in`
    element.style.animationDelay = `${index * 0.05}s`

    if (item.type === "pm") {
      element.innerHTML = `
        <a href="${item.url}" target="_blank" class="flex items-start group">
          <div class="relative">
            <img src="${item.avatar}" alt="${item.user}" class="w-10 h-10 rounded-full mr-3 border-2 border-transparent group-hover:border-blue-500 transition-all">
            <div class="absolute bottom-0 right-0 w-3 h-3 bg-blue-500 rounded-full border-2 border-white dark:border-gray-800"></div>
          </div>
          <div class="flex-1">
            <div class="font-medium text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">${item.title}</div>
            <div class="text-sm text-gray-600 dark:text-gray-400">${item.user}</div>
            <div class="text-xs text-gray-500 dark:text-gray-500 mt-1 flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              ${item.date}
            </div>
          </div>
        </a>
      `
    } else {
      element.innerHTML = `
        <a href="${item.url}" target="_blank" class="flex items-start group">
          <div class="relative">
            <img src="${item.avatar}" alt="Bildirim" class="w-10 h-10 rounded-full mr-3 border-2 border-transparent group-hover:border-red-500 transition-all">
            <div class="absolute bottom-0 right-0 w-3 h-3 bg-red-500 rounded-full border-2 border-white dark:border-gray-800"></div>
          </div>
          <div class="flex-1">
            <div class="text-sm text-gray-800 dark:text-gray-200 group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors">${item.notify}</div>
            <div class="text-xs text-gray-500 dark:text-gray-500 mt-1 flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              ${item.date}
            </div>
          </div>
        </a>
      `
    }

    notificationList.appendChild(element)
  })
}

// Türkçe tarih formatını parse etmek için yardımcı fonksiyon
function parseTurkishDate(dateStr) {
  try {
    // "Bugün" ve "Dün" kontrolü
    if (dateStr.includes('Bugün')) {
      const today = new Date()
      const time = dateStr.split(' ')[1].split(':')
      today.setHours(parseInt(time[0]), parseInt(time[1]), 0)
      return today
    }
    
    if (dateStr.includes('Dün')) {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      const time = dateStr.split(' ')[1].split(':')
      yesterday.setHours(parseInt(time[0]), parseInt(time[1]), 0)
      return yesterday
    }

    // Normal tarih formatı (örn: "15-05-2025 14:30")
    const parts = dateStr.trim().split(' ')
    const dateParts = parts[0].split('-')
    const timeParts = parts[1].split(':')
    
    return new Date(
      parseInt(dateParts[2]), // yıl
      parseInt(dateParts[1]) - 1, // ay (0-11)
      parseInt(dateParts[0]), // gün
      parseInt(timeParts[0]), // saat
      parseInt(timeParts[1]) // dakika
    )
  } catch (error) {
    console.error('Tarih parse edilirken hata:', error)
    return new Date(0) // Hata durumunda en eski tarih
  }
}

// Sekme değiştir
function switchTab(tab) {
  activeTab = tab

  // Tab butonlarını güncelle
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.classList.remove("text-blue-600", "dark:text-blue-400", "border-b-2", "border-blue-600", "dark:border-blue-400")
    btn.classList.add("text-gray-600", "dark:text-gray-400")
  })

  // Aktif tab'ı vurgula
  if (tab === "all") {
    tabAll.classList.add("text-blue-600", "dark:text-blue-400", "border-b-2", "border-blue-600", "dark:border-blue-400")
    tabAll.classList.remove("text-gray-600", "dark:text-gray-400")
  } else if (tab === "pm") {
    tabPm.classList.add("text-blue-600", "dark:text-blue-400", "border-b-2", "border-blue-600", "dark:border-blue-400")
    tabPm.classList.remove("text-gray-600", "dark:text-gray-400")
  } else if (tab === "notify") {
    tabNotify.classList.add(
      "text-blue-600",
      "dark:text-blue-400",
      "border-b-2",
      "border-blue-600",
      "dark:border-blue-400",
    )
    tabNotify.classList.remove("text-gray-600", "dark:text-gray-400")
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
    emptyState.classList.add("hidden")
  } else {
    loadingIndicator.classList.add("hidden")
  }
}

// Hata mesajı göster
function showError(message) {
  const errorElement = document.createElement("div")
  errorElement.className =
    "bg-red-100 dark:bg-red-900 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg mb-4 fade-in"
  errorElement.innerHTML = `
    <div class="flex items-center">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span>${message}</span>
    </div>
  `

  // Mevcut hata mesajlarını kaldır
  document.querySelectorAll(".bg-red-100").forEach((el) => el.remove())

  // Yeni hata mesajını ekle
  document.querySelector(".container").insertBefore(errorElement, document.querySelector("header").nextSibling)

  // 5 saniye sonra kaldır
  setTimeout(() => {
    errorElement.classList.add("fade-out")
    setTimeout(() => {
      errorElement.remove()
    }, 300)
  }, 5000)
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
