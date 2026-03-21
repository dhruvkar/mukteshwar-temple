// Mukteshwar Temple - Shared JavaScript

// Navbar scroll effect
window.addEventListener('scroll', () => {
    const navbar = document.getElementById('navbar');
    if (navbar) {
        navbar.classList.toggle('scrolled', window.scrollY > 50);
    }
});

// Fade-in on scroll
const observer = new IntersectionObserver((entries) => {
    entries.forEach(e => { 
        if (e.isIntersecting) e.target.classList.add('visible'); 
    });
}, { threshold: 0.1 });

// Apply fade-in to all elements with fade-in class
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.fade-in').forEach(el => observer.observe(el));
});

// Mobile menu toggle
function toggleMobileMenu() {
    const navLinks = document.querySelector('.nav-links');
    if (navLinks) {
        navLinks.classList.toggle('open');
    }
}

// Close mobile menu on link click
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.nav-links a').forEach(a => {
        a.addEventListener('click', () => {
            const navLinks = document.querySelector('.nav-links');
            if (navLinks) {
                navLinks.classList.remove('open');
            }
        });
    });
});

// Highlight current page in navigation
function setCurrentPage(pageName) {
    document.addEventListener('DOMContentLoaded', () => {
        const navLinks = document.querySelectorAll('.nav-links a');
        navLinks.forEach(link => {
            link.classList.remove('current');
            if (link.textContent.toLowerCase().includes(pageName.toLowerCase()) ||
                (pageName === 'home' && link.getAttribute('href') === 'index.html')) {
                link.classList.add('current');
            }
        });
    });
}

// Gallery lightbox functionality
function initGallery() {
    const galleryItems = document.querySelectorAll('.gallery-item');
    const lightbox = document.querySelector('.lightbox');
    const lightboxImg = document.querySelector('.lightbox-content img');
    const lightboxClose = document.querySelector('.lightbox-close');
    const lightboxPrev = document.querySelector('.lightbox-nav.prev');
    const lightboxNext = document.querySelector('.lightbox-nav.next');
    
    let currentImageIndex = 0;
    const images = Array.from(galleryItems).filter(item => item.querySelector('img'));
    
    if (!lightbox || images.length === 0) return;
    
    // Open lightbox
    galleryItems.forEach((item, index) => {
        const img = item.querySelector('img');
        if (img) {
            item.addEventListener('click', () => {
                currentImageIndex = images.findIndex(imgItem => imgItem === item);
                showLightboxImage();
                lightbox.classList.add('active');
                document.body.style.overflow = 'hidden';
            });
        }
    });
    
    // Close lightbox
    function closeLightbox() {
        lightbox.classList.remove('active');
        document.body.style.overflow = '';
    }
    
    if (lightboxClose) {
        lightboxClose.addEventListener('click', closeLightbox);
    }
    
    lightbox.addEventListener('click', (e) => {
        if (e.target === lightbox) {
            closeLightbox();
        }
    });
    
    // Navigate images
    function showLightboxImage() {
        const img = images[currentImageIndex].querySelector('img');
        if (img && lightboxImg) {
            lightboxImg.src = img.src;
            lightboxImg.alt = img.alt;
        }
    }
    
    if (lightboxPrev) {
        lightboxPrev.addEventListener('click', () => {
            currentImageIndex = currentImageIndex > 0 ? currentImageIndex - 1 : images.length - 1;
            showLightboxImage();
        });
    }
    
    if (lightboxNext) {
        lightboxNext.addEventListener('click', () => {
            currentImageIndex = currentImageIndex < images.length - 1 ? currentImageIndex + 1 : 0;
            showLightboxImage();
        });
    }
    
    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
        if (!lightbox.classList.contains('active')) return;
        
        switch (e.key) {
            case 'Escape':
                closeLightbox();
                break;
            case 'ArrowLeft':
                if (lightboxPrev) lightboxPrev.click();
                break;
            case 'ArrowRight':
                if (lightboxNext) lightboxNext.click();
                break;
        }
    });
}

// Gallery filters
function initGalleryFilters() {
    const filters = document.querySelectorAll('.gallery-filter');
    const galleryItems = document.querySelectorAll('.gallery-item');
    
    if (filters.length === 0 || galleryItems.length === 0) return;
    
    filters.forEach(filter => {
        filter.addEventListener('click', () => {
            // Update active filter
            filters.forEach(f => f.classList.remove('active'));
            filter.classList.add('active');
            
            const filterValue = filter.getAttribute('data-filter');
            
            // Show/hide gallery items
            galleryItems.forEach(item => {
                const itemCategories = item.getAttribute('data-category');
                if (filterValue === 'all' || itemCategories.includes(filterValue)) {
                    item.style.display = 'flex';
                } else {
                    item.style.display = 'none';
                }
            });
        });
    });
}

// Month availability click handler
function initMonthAvailability() {
    const monthCards = document.querySelectorAll('.month-card.available');
    
    monthCards.forEach(card => {
        card.addEventListener('click', () => {
            const monthName = card.querySelector('.month-name').textContent;
            
            // Scroll to registration section
            const registerSection = document.getElementById('register');
            if (registerSection) {
                registerSection.scrollIntoView({ behavior: 'smooth' });
                
                // Pre-select month in form
                setTimeout(() => {
                    const monthSelect = document.querySelector('select[name="preferredMonth"]');
                    if (monthSelect) {
                        for (let option of monthSelect.options) {
                            if (option.text.includes(monthName.split(' ')[0])) {
                                monthSelect.value = option.value;
                                break;
                            }
                        }
                    }
                }, 500);
            }
        });
    });
}

// Multi-step form functionality
function initMultiStepForm() {
    let currentStep = 1;
    const totalSteps = 3;
    
    // Update form step display
    function updateFormStep() {
        // Update step indicators
        document.querySelectorAll('.form-step').forEach((step, index) => {
            const stepNum = index + 1;
            step.classList.remove('active', 'completed');
            
            if (stepNum === currentStep) {
                step.classList.add('active');
            } else if (stepNum < currentStep) {
                step.classList.add('completed');
            }
        });
        
        // Show/hide form sections
        document.querySelectorAll('[data-step]').forEach(section => {
            const stepNum = parseInt(section.getAttribute('data-step'));
            section.style.display = stepNum === currentStep ? 'contents' : 'none';
        });
        
        // Update navigation buttons
        const prevBtn = document.getElementById('prevStep');
        const nextBtn = document.getElementById('nextStep');
        const submitBtn = document.getElementById('submitForm');
        
        if (prevBtn) prevBtn.style.display = currentStep === 1 ? 'none' : 'inline-block';
        if (nextBtn) nextBtn.style.display = currentStep === totalSteps ? 'none' : 'inline-block';
        if (submitBtn) submitBtn.style.display = currentStep === totalSteps ? 'inline-block' : 'none';
    }
    
    // Form navigation
    const prevBtn = document.getElementById('prevStep');
    const nextBtn = document.getElementById('nextStep');
    
    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            if (currentStep > 1) {
                currentStep--;
                updateFormStep();
            }
        });
    }
    
    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            if (validateCurrentStep() && currentStep < totalSteps) {
                currentStep++;
                updateFormStep();
            }
        });
    }
    
    // Form validation
    function validateCurrentStep() {
        const currentStepElement = document.querySelector(`[data-step="${currentStep}"]`);
        if (!currentStepElement) return true;
        
        const requiredFields = currentStepElement.querySelectorAll('[required]');
        let isValid = true;
        
        requiredFields.forEach(field => {
            if (!field.value.trim()) {
                field.style.borderColor = '#ff6b6b';
                isValid = false;
            } else {
                field.style.borderColor = '';
            }
        });
        
        return isValid;
    }
    
    // Initialize form step
    updateFormStep();
}

// Initialize all functionality when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    initGallery();
    initGalleryFilters();
    initMonthAvailability();
    initMultiStepForm();
});