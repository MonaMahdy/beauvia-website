// ========================================
// BEAUVIA&CO - Main JavaScript File
// يقرا البيانات من products.json
// ========================================

// تحميل البيانات من JSON
async function loadData() {
    try {
        const response = await fetch('products.json');
        const data = await response.json();
        
        // عرض المنتجات
        displayProducts(data.products);
        
        // عرض الروتينات
        displayRoutines(data.routines);
        
        // تحديث معلومات التواصل
        updateContactInfo(data.site_settings);
        
        // تحديث السوشيال ميديا
        updateSocialLinks(data.site_settings.social_media);
        
        // تحديث الـ Announcement Bar
        updateAnnouncementBar(data.site_settings.announcement_bar);
        
    } catch (error) {
        console.error('Error loading data:', error);
        showError();
    }
}

// ========================================
// عرض المنتجات
// ========================================
function displayProducts(products) {
    const container = document.getElementById('productsContainer');
    
    if (!products || products.length === 0) {
        container.innerHTML = '<p class="loading">No products available</p>';
        return;
    }
    
    container.innerHTML = products.map(product => `
        <div class="product-card" data-category="${product.category}">
            <div class="product-image">
                <div class="product-badge">${product.badge}</div>
                <div class="product-tag">${product.tag}</div>
                <div class="product-placeholder">🧴</div>
            </div>
            <div class="product-info">
                <h3 class="product-name">${product.name}</h3>
                <div class="product-price">${product.price} ${product.currency}</div>
                <p class="product-description">${product.description}</p>
                <button class="btn-add-to-bag" onclick="addToCart(${product.id}, '${product.name}', ${product.price})">
                    Add to Bag
                </button>
            </div>
        </div>
    `).join('');
}

// ========================================
// عرض الروتينات
// ========================================
function displayRoutines(routines) {
    const container = document.getElementById('routinesContainer');
    
    if (!routines || routines.length === 0) {
        container.innerHTML = '<p class="loading">No routines available</p>';
        return;
    }
    
    container.innerHTML = routines.map(routine => `
        <div class="routine-card">
            <div class="routine-image">${routine.icon}</div>
            <div class="routine-content">
                <h3>${routine.name}</h3>
                <p>${routine.description}</p>
                <div class="routine-products">
                    ${routine.products_count} Products • ${routine.type}
                </div>
                <a href="#" class="btn-secondary">View Routine</a>
            </div>
        </div>
    `).join('');
}

// ========================================
// تحديث معلومات التواصل
// ========================================
function updateContactInfo(settings) {
    const container = document.getElementById('contactInfo');
    
    container.innerHTML = `
        <div class="contact-item">
            <h3>Email</h3>
            <p><a href="mailto:${settings.email}">${settings.email}</a></p>
        </div>
        <div class="contact-item">
            <h3>Location</h3>
            <p>${settings.location}</p>
        </div>
        <div class="contact-item">
            <h3>Business Hours</h3>
            <p>${settings.business_hours.weekdays}<br>${settings.business_hours.friday}</p>
        </div>
    `;
    
    // تحديث الإيميل في الـ Footer
    const footerEmail = document.getElementById('footerEmail');
    if (footerEmail) {
        footerEmail.innerHTML = `<a href="mailto:${settings.email}">${settings.email}</a>`;
    }
    
    // تحديث الـ Copyright
    const footerCopyright = document.getElementById('footerCopyright');
    if (footerCopyright) {
        footerCopyright.innerHTML = `<p>&copy; 2024 ${settings.brand_name}. All rights reserved. ${settings.announcement_bar}.</p>`;
    }
}

// ========================================
// تحديث روابط السوشيال ميديا
// ========================================
function updateSocialLinks(social) {
    const container = document.getElementById('socialLinks');
    
    container.innerHTML = `
        <a href="${social.instagram}" target="_blank">📷</a>
        <a href="${social.facebook}" target="_blank">📱</a>
        <a href="mailto:admin@beauvia.net">✉️</a>
    `;
}

// ========================================
// تحديث Announcement Bar
// ========================================
function updateAnnouncementBar(text) {
    const bar = document.getElementById('announcementBar');
    if (bar && text) {
        bar.textContent = text;
    }
}

// ========================================
// إضافة للعربة (مبدئي)
// ========================================
function addToCart(id, name, price) {
    // يمكن تطويرها لاحقاً لعربة حقيقية
    const button = event.target;
    const originalText = button.textContent;
    
    button.textContent = '✓ Added to Bag';
    button.style.background = 'var(--soft-blush)';
    
    // رسالة للكونسول
    console.log(`Added to cart: ${name} - ${price} EGP`);
    
    // العودة للنص الأصلي بعد ثانيتين
    setTimeout(() => {
        button.textContent = originalText;
        button.style.background = 'var(--forest-green)';
    }, 2000);
    
    // يمكن إضافة WhatsApp Order هنا
    // orderViaWhatsApp(name, price);
}

// ========================================
// طلب عبر WhatsApp (اختياري)
// ========================================
function orderViaWhatsApp(productName, price) {
    const phone = "201234567890"; // ⚠️ غيري الرقم هنا
    const message = `Hello! I want to order:
    
Product: ${productName}
Price: ${price} EGP

Please send me payment details!`;
    
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
}

// ========================================
// Toggle Menu
// ========================================
function toggleMenu() {
    const menu = document.querySelector('.nav-menu');
    const overlay = document.querySelector('.nav-overlay');
    menu.classList.toggle('active');
    overlay.classList.toggle('active');
}

// ========================================
// Smooth Scroll
// ========================================
document.addEventListener('DOMContentLoaded', function() {
    // Smooth scroll for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
});

// ========================================
// عرض رسالة خطأ
// ========================================
function showError() {
    const productsContainer = document.getElementById('productsContainer');
    const routinesContainer = document.getElementById('routinesContainer');
    
    const errorMessage = `
        <div class="loading" style="color: #d32f2f;">
            <p>⚠️ Could not load data from products.json</p>
            <p style="font-size: 14px; margin-top: 10px;">
                Please make sure products.json is in the same folder as index.html
            </p>
        </div>
    `;
    
    if (productsContainer) productsContainer.innerHTML = errorMessage;
    if (routinesContainer) routinesContainer.innerHTML = errorMessage;
}

// ========================================
// تحميل البيانات عند فتح الصفحة
// ========================================
window.addEventListener('DOMContentLoaded', loadData);
