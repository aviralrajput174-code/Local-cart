/* ==========================================
   LOCALCART MVP
   JavaScript Application
   ========================================== */

"use strict";

/*
 IMPORTANT:
 This is a browser-based prototype.
 Data is stored in the current browser only.
 It is NOT shared between different devices.
*/

// ---------- STORAGE ----------

const STORAGE_KEY = "localcart_mvp_v1";

function loadData() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);

        if (saved) {
            const parsed = JSON.parse(saved);

            return {
                shops: Array.isArray(parsed.shops) ? parsed.shops : [],
                products: Array.isArray(parsed.products) ? parsed.products : [],
                cart: Array.isArray(parsed.cart) ? parsed.cart : [],
                orders: Array.isArray(parsed.orders) ? parsed.orders : [],
                activeShopId: parsed.activeShopId || null
            };
        }
    } catch (error) {
        console.error("Could not load saved data:", error);
    }

    return {
        shops: [],
        products: [],
        cart: [],
        orders: [],
        activeShopId: null
    };
}

const state = loadData();

function saveData() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        return true;
    } catch (error) {
        console.error("Could not save data:", error);
        notify("Storage is full or unavailable. Some changes may not be saved.");
        return false;
    }
}

// ---------- HELPERS ----------

function $(id) {
    return document.getElementById(id);
}

function createId(prefix = "item") {
    return prefix + "_" + Date.now().toString(36) +
        "_" + Math.random().toString(36).slice(2, 9);
}

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => {
        const entities = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        };

        return entities[character];
    });
}

function money(amount) {
    return "₹" + Number(amount || 0).toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function notify(message) {
    const box = $("notification");

    if (!box) {
        alert(message);
        return;
    }

    box.textContent = message;
    box.classList.add("show");

    clearTimeout(notify.timer);

    notify.timer = setTimeout(() => {
        box.classList.remove("show");
    }, 3000);
}

function activeShop() {
    return state.shops.find(shop => shop.id === state.activeShopId) || null;
}

function activeShopProducts() {
    const shop = activeShop();

    if (!shop) return [];

    return state.products.filter(product => product.shopId === shop.id);
}

function getProduct(productId) {
    return state.products.find(product => product.id === productId);
}

function getShop(shopId) {
    return state.shops.find(shop => shop.id === shopId);
}

// ---------- NAVIGATION ----------

function showView(viewName) {
    document.querySelectorAll(".view").forEach(view => {
        view.classList.remove("active");
    });

    const target = document.getElementById(`${viewName}-view`);

    if (target) {
        target.classList.add("active");
    }
}
    document.querySelectorAll("[data-view]").forEach(button => {
        button.classList.toggle(
            "active",
            button.dataset.view === viewName
        );
    });

    if (viewName === "customer") {
        renderShops();
        renderProducts();
    }

    if (viewName === "shopkeeper") {
        renderShopProfile();
        renderManageProducts();
        renderShopkeeperOrders();
    }

    if (viewName === "cart") {
        renderCart();
    }

    if (viewName === "orders") {
        renderCustomerOrders();
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
}

document.querySelectorAll("[data-view]").forEach(button => {
    button.addEventListener("click", () => {
        showView(button.dataset.view);
    });
});

// ---------- SHOP PROFILE ----------

function renderShopProfile() {
    const shop = activeShop();

    if (!shop) {
        $("shop-form").reset();
        $("shop-distance").value = "2";
        $("delivery-rate").value = "5";
        return;
    }

    $("shop-name").value = shop.name;
    $("shop-owner").value = shop.owner;
    $("shop-phone").value = shop.phone;
    $("shop-address").value = shop.address;
    $("shop-distance").value = shop.maxDistance;
    $("delivery-rate").value = shop.ratePerKm;
}

$("shop-form").addEventListener("submit", event => {
    event.preventDefault();

    const name = $("shop-name").value.trim();
    const owner = $("shop-owner").value.trim();
    const phone = $("shop-phone").value.trim();
    const address = $("shop-address").value.trim();
    const maxDistance = Number($("shop-distance").value);
    const ratePerKm = Number($("delivery-rate").value);

    if (!name || !owner || !phone || !address) {
        notify("Please complete all shop details.");
        return;
    }

    if (
        !Number.isFinite(maxDistance) ||
        maxDistance < 0 ||
        !Number.isFinite(ratePerKm) ||
        ratePerKm < 0
    ) {
        notify("Please enter valid delivery settings.");
        return;
    }

    let shop = activeShop();

    if (shop) {
        shop.name = name;
        shop.owner = owner;
        shop.phone = phone;
        shop.address = address;
        shop.maxDistance = maxDistance;
        shop.ratePerKm = ratePerKm;
    } else {
        shop = {
            id: createId("shop"),
            name,
            owner,
            phone,
            address,
            maxDistance,
            ratePerKm,
            createdAt: new Date().toISOString()
        };

        state.shops.push(shop);
        state.activeShopId = shop.id;
    }

    saveData();

    renderShopProfile();
    renderShops();
    renderProducts();
    renderShopkeeperOrders();

    notify("Shop profile saved successfully.");
});

// ---------- BULK PRODUCT IMPORT ----------

/*
 Accepted formats, one product per line:

 Rice, 60, 1 kg
 Sugar, 45, 1 kg
 Milk, 30, 500 ml

 The price must be a number.
*/

function parseProductLine(line) {
    const parts = line.split(",").map(part => part.trim());

    if (parts.length < 2) {
        return {
            error: "Use: Product Name, Price, Unit"
        };
    }

    const name = parts[0];
    const price = Number(parts[1]);
    const unit = parts.slice(2).join(",") || "piece";

    if (!name) {
        return { error: "Product name is missing." };
    }

    if (!Number.isFinite(price) || price < 0) {
        return { error: "Invalid price for " + name };
    }

    return {
        name,
        price,
        unit
    };
}

$("bulk-product-form").addEventListener("submit", event => {
    event.preventDefault();

    const shop = activeShop();

    if (!shop) {
        notify("Please save your shop profile first.");
        return;
    }

    const text = $("bulk-products").value.trim();

    if (!text) {
        notify("Please enter a product list.");
        return;
    }

    const lines = text
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean);

    const productsToAdd = [];
    const errors = [];

    lines.forEach((line, index) => {
        const product = parseProductLine(line);

        if (product.error) {
            errors.push("Line " + (index + 1) + ": " + product.error);
        } else {
            productsToAdd.push({
                id: createId("product"),
                shopId: shop.id,
                name: product.name,
                price: product.price,
                unit: product.unit,
                createdAt: new Date().toISOString()
            });
        }
    });

    if (productsToAdd.length === 0) {
        notify(errors[0] || "No valid products found.");
        return;
    }

    state.products.push(...productsToAdd);

    saveData();

    $("bulk-products").value = "";

    renderProducts();
    renderManageProducts();
    renderShops();

    if (errors.length) {
        notify(
            productsToAdd.length +
            " products added. " +
            errors.length +
            " lines were skipped. Check the format."
        );

        console.warn("Product import errors:", errors);
    } else {
        notify(productsToAdd.length + " products added successfully.");
    }
});

// ---------- MANAGE PRODUCTS ----------

function renderManageProducts() {
    const container = $("manage-product-list");
    const products = activeShopProducts();

    if (!products.length) {
        container.innerHTML =
            '<p class="empty-message">No products added yet.</p>';
        return;
    }

    container.innerHTML = products.map(product => `
        <div class="manage-item">
            <div>
                <h4>${escapeHTML(product.name)}</h4>
                <p>
                    ${money(product.price)} / ${escapeHTML(product.unit)}
                </p>
            </div>

            <div class="manage-actions">
                <button
                    type="button"
                    class="secondary-btn"
                    data-action="edit-product"
                    data-id="${escapeHTML(product.id)}">
                    Edit
                </button>

                <button
                    type="button"
                    class="danger-btn"
                    data-action="delete-product"
                    data-id="${escapeHTML(product.id)}">
                    Delete
                </button>
            </div>
        </div>
    `).join("");
}

$("manage-product-list").addEventListener("click", event => {
    const button = event.target.closest("button[data-action]");

    if (!button) return;

    const product = getProduct(button.dataset.id);

    if (!product || product.shopId !== state.activeShopId) {
        notify("Product not found.");
        return;
    }

    if (button.dataset.action === "edit-product") {
        const newName = prompt("Product name:", product.name);

        if (newName === null) return;

        const newPriceText = prompt(
            "Price in rupees:",
            String(product.price)
        );

        if (newPriceText === null) return;

        const newUnit = prompt("Unit:", product.unit);

        if (newUnit === null) return;

        const name = newName.trim();
        const price = Number(newPriceText);
        const unit = newUnit.trim();

        if (!name || !unit || !Number.isFinite(price) || price < 0) {
            notify("Please enter valid product details.");
            return;
        }

        product.name = name;
        product.price = price;
        product.unit = unit;

        saveData();

        renderManageProducts();
        renderProducts();
        renderCart();

        notify("Product updated.");
    }

    if (button.dataset.action === "delete-product") {
        const confirmed = confirm(
            "Delete " + product.name + " from your shop?"
        );

        if (!confirmed) return;

        state.products = state.products.filter(
            item => item.id !== product.id
        );

        state.cart = state.cart.filter(
            item => item.productId !== product.id
        );

        saveData();

        renderManageProducts();
        renderProducts();
        renderCart();
        renderShops();

        notify("Product deleted.");
    }
});

// ---------- SHOP CARDS ----------

function renderShops() {
    const container = $("shop-list");
    const filter = $("shop-filter");
    const previousValue = filter.value;

    if (!state.shops.length) {
        container.innerHTML =
            '<p class="empty-message">No shops listed yet.</p>';

        filter.innerHTML = '<option value="all">All Shops</option>';
        return;
    }

    container.innerHTML = state.shops.map(shop => {
        const productCount = state.products.filter(
            product => product.shopId === shop.id
        ).length;

        return `
            <article class="shop-card">
                <div class="shop-image" aria-hidden="true">🏪</div>

                <div class="shop-info">
                    <h3>${escapeHTML(shop.name)}</h3>

                    <p>${escapeHTML(shop.address)}</p>

                    <p>${productCount} products</p>

                    <button
                        type="button"
                        class="primary-btn"
                        data-action="view-shop"
                        data-id="${escapeHTML(shop.id)}">
                        View Products
                    </button>
                </div>
            </article>
        `;
    }).join("");

    filter.innerHTML =
        '<option value="all">All Shops</option>' +
        state.shops.map(shop => `
            <option value="${escapeHTML(shop.id)}">
                ${escapeHTML(shop.name)}
            </option>
        `).join("");

    if (
        previousValue === "all" ||
        state.shops.some(shop => shop.id === previousValue)
    ) {
        filter.value = previousValue;
    }
}

$("shop-list").addEventListener("click", event => {
    const button = event.target.closest('[data-action="view-shop"]');

    if (!button) return;

    $("shop-filter").value = button.dataset.id;
    renderProducts();

    $("product-list").scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
});

// ---------- PRODUCT CARDS ----------

function renderProducts() {
    const container = $("product-list");
    const search = $("product-search").value.trim().toLowerCase();
    const selectedShop = $("shop-filter").value;

    let products = state.products;

    if (selectedShop !== "all") {
        products = products.filter(
            product => product.shopId === selectedShop
        );
    }

    if (search) {
        products = products.filter(product => {
            const shop = getShop(product.shopId);

            return (
                product.name.toLowerCase().includes(search) ||
                product.unit.toLowerCase().includes(search) ||
                (shop && shop.name.toLowerCase().includes(search))
            );
        });
    }

    $("no-products").style.display =
        products.length ? "none" : "block";

    if (!products.length) {
        container.innerHTML = "";
        return;
    }

    container.innerHTML = products.map(product => {
        const shop = getShop(product.shopId);

        return `
            <article class="product-card">
                <div class="product-image" aria-hidden="true">🛍️</div>

                <div class="product-info">
                    <h3>${escapeHTML(product.name)}</h3>

                    <p>${escapeHTML(shop ? shop.name : "Local Shop")}</p>

                    <p>Unit: ${escapeHTML(product.unit)}</p>

                    <strong class="product-price">
                        ${money(product.price)}
                    </strong>

                    <button
                        type="button"
                        class="primary-btn"
                        data-action="add-to-cart"
                        data-id="${escapeHTML(product.id)}">
                        Add to Cart
                    </button>
                </div>
            </article>
        `;
    }).join("");
}

$("search-btn").addEventListener("click", renderProducts);

$("product-search").addEventListener("input", renderProducts);

$("shop-filter").addEventListener("change", renderProducts);

$("product-list").addEventListener("click", event => {
    const button = event.target.closest('[data-action="add-to-cart"]');

    if (!button) return;

    const product = getProduct(button.dataset.id);

    if (!product) {
        notify("Product is no longer available.");
        return;
    }

    const existing = state.cart.find(
        item => item.productId === product.id
    );

    /*
     One cart can contain products from only one shop
     in this prototype. A multi-shop cart requires
     separate deliveries and checkout totals.
    */

    const currentShopId = state.cart.length
        ? getProduct(state.cart[0].productId)?.shopId
        : null;

    if (currentShopId && currentShopId !== product.shopId) {
        const shouldReplace = confirm(
            "Your cart contains products from another shop. " +
            "Clear the cart and add this product instead?"
        );

        if (!shouldReplace) return;

        state.cart = [];
    }

    const cartItem = state.cart.find(
        item => item.productId === product.id
    );

    if (cartItem) {
        cartItem.quantity += 1;
    } else {
        state.cart.push({
            productId: product.id,
            quantity: 1
        });
    }

    saveData();
    renderCart();
    updateCartCount();

    notify("Added to cart.");
});

// ---------- CART ----------

function getCartDetails() {
    const items = state.cart
        .map(item => {
            const product = getProduct(item.productId);

            if (!product) return null;

            return {
                product,
                quantity: item.quantity,
                lineTotal: product.price * item.quantity
            };
        })
        .filter(Boolean);

    const subtotal = items.reduce(
        (sum, item) => sum + item.lineTotal,
        0
    );

    return { items, subtotal };
}

function getDeliveryDetails() {
    const { subtotal } = getCartDetails();

    if (!state.cart.length) {
        return {
            distance: 0,
            deliveryCharge: 0,
            total: 0,
            error: null
        };
    }

    const product = getProduct(state.cart[0].productId);
    const shop = product ? getShop(product.shopId) : null;

    if (!shop) {
        return {
            distance: 0,
            deliveryCharge: 0,
            total: subtotal,
            error: "Shop not found."
        };
    }

    const distance = Number($("customer-distance").value);

    if (!Number.isFinite(distance) || distance < 0) {
        return {
            distance: 0,
            deliveryCharge: 0,
            total: subtotal,
            error: "Enter a valid delivery distance."
        };
    }

    if (distance > Number(shop.maxDistance)) {
        return {
            distance,
            deliveryCharge: 0,
            total: subtotal,
            error: "This distance is outside the shop's delivery range."
        };
    }

    /*
      Example:
      2 km × ₹5/km = ₹10 delivery charge.

      This is a configurable demonstration formula,
      not a verified petrol cost or courier commission.
    */

    const deliveryCharge = Math.ceil(
        distance * Number(shop.ratePerKm)
    );

    return {
        distance,
        deliveryCharge,
        total: subtotal + deliveryCharge,
        error: null
    };
}

function renderCart() {
    const container = $("cart-items");
    const { items, subtotal } = getCartDetails();

    $("empty-cart").style.display = items.length ? "none" : "block";

    if (!items.length) {
        container.innerHTML = "";
    } else {
        container.innerHTML = items.map(item => `
            <div class="cart-item">
                <div>
                    <h4>${escapeHTML(item.product.name)}</h4>

                    <p>
                        ${money(item.product.price)} × ${item.quantity}
                        = ${money(item.lineTotal)}
                    </p>
                </div>

                <div class="quantity-controls">
                    <button
                        type="button"
                        data-action="decrease"
                        data-id="${escapeHTML(item.product.id)}"
                        aria-label="Decrease quantity">
                        −
                    </button>

                    <strong>${item.quantity}</strong>

                    <button
                        type="button"
                        data-action="increase"
                        data-id="${escapeHTML(item.product.id)}"
                        aria-label="Increase quantity">
                        +
                    </button>

                    <button
                        type="button"
                        class="danger-btn"
                        data-action="remove"
                        data-id="${escapeHTML(item.product.id)}">
                        Remove
                    </button>
                </div>
            </div>
        `).join("");
    }

    const delivery = getDeliveryDetails();

    $("cart-subtotal").textContent = money(subtotal);
    $("delivery-charge").textContent = money(delivery.deliveryCharge);
    $("cart-total").textContent = money(delivery.total);

    if (delivery.error) {
        $("delivery-charge").textContent = "Unavailable";

        $("cart-total").textContent = money(subtotal);

        $("delivery-charge").title = delivery.error;
    } else {
        $("delivery-charge").title =
            delivery.distance + " km × shop delivery rate";
    }

    updateCartCount();
}

$("cart-items").addEventListener("click", event => {
    const button = event.target.closest("button[data-action]");

    if (!button) return;

    const productId = button.dataset.id;
    const item = state.cart.find(
        cartItem => cartItem.productId === productId
    );

    if (!item) return;

    switch (button.dataset.action) {
        case "increase":
            item.quantity += 1;
            break;

        case "decrease":
            item.quantity -= 1;

            if (item.quantity <= 0) {
                state.cart = state.cart.filter(
                    cartItem => cartItem.productId !== productId
                );
            }
            break;

        case "remove":
            state.cart = state.cart.filter(
                cartItem => cartItem.productId !== productId
            );
            break;
    }

    saveData();
    renderCart();
});

$("customer-distance").addEventListener("input", renderCart);

function updateCartCount() {
    const count = state.cart.reduce(
        (sum, item) => sum + item.quantity,
        0
    );

    $("cart-count").textContent = count;
}

// ---------- PLACE ORDER ----------

$("checkout-form").addEventListener("submit", event => {
    event.preventDefault();

    const { items, subtotal } = getCartDetails();

    if (!items.length) {
        notify("Your cart is empty.");
        return;
    }

    const customerName = $("customer-name").value.trim();
    const customerPhone = $("customer-phone").value.trim();
    const customerAddress = $("customer-address").value.trim();

    if (!customerName || !customerPhone || !customerAddress) {
        notify("Please complete your delivery details.");
        return;
    }

    const delivery = getDeliveryDetails();

    if (delivery.error) {
        notify(delivery.error);
        return;
    }

    const firstProduct = items[0].product;
    const shop = getShop(firstProduct.shopId);

    if (!shop) {
        notify("The shop for this order could not be found.");
        return;
    }

    const order = {
        id: createId("order"),
        customerName,
        customerPhone,
        customerAddress,
        shopId: shop.id,

        items: items.map(item => ({
            productId: item.product.id,
            name: item.product.name,
            unit: item.product.unit,
            price: item.product.price,
            quantity: item.quantity,
            lineTotal: item.lineTotal
        })),

        subtotal,
        distance: delivery.distance,
        deliveryCharge: delivery.deliveryCharge,
        total: delivery.total,

        paymentMethod: "Cash on Delivery",
        paymentStatus: "Pay on delivery",
        status: "Pending",
        createdAt: new Date().toISOString()
    };

    state.orders.unshift(order);
    state.cart = [];

    saveData();

    $("checkout-form").reset();
    $("customer-distance").value = "2";

    renderCart();
    renderCustomerOrders();
    renderShopkeeperOrders();

    notify("Demo order placed successfully.");

    showView("orders");
});

// ---------- CUSTOMER ORDER HISTORY ----------

function renderCustomerOrders() {
    const container = $("customer-orders");

    if (!state.orders.length) {
        container.innerHTML = "";
        $("no-orders").style.display = "block";
        return;
    }

    $("no-orders").style.display = "none";

    container.innerHTML = state.orders.map(order => {
        const shop = getShop(order.shopId);

        const itemsHTML = order.items.map(item => `
            <p>
                ${escapeHTML(item.name)}
                × ${item.quantity}
                — ${money(item.lineTotal)}
            </p>
        `).join("");

        return `
            <article class="order-card">
                <h3>Order #${escapeHTML(order.id.slice(-8))}</h3>

                <p>Shop: ${escapeHTML(shop ? shop.name : "Local Shop")}</p>

                <p>Date: ${new Date(order.createdAt).toLocaleString("en-IN")}</p>

                ${itemsHTML}

                <p>Subtotal: ${money(order.subtotal)}</p>

                <p>Delivery: ${money(order.deliveryCharge)}</p>

                <h3>Total: ${money(order.total)}</h3>

                <p>Payment: Cash on Delivery</p>

                <span class="order-status ${statusClass(order.status)}">
                    ${escapeHTML(order.status)}
                </span>

                <p>
                    Delivery: Shopkeeper or their delivery team.
                </p>
            </article>
        `;
    }).join("");
}

// ---------- SHOPKEEPER ORDER MANAGEMENT ----------

function statusClass(status) {
    const classes = {
        "Pending": "status-pending",
        "Preparing": "status-preparing",
        "Ready": "status-ready",
        "Completed": "status-completed"
    };

    return classes[status] || "status-pending";
}

function renderShopkeeperOrders() {
    const container = $("shopkeeper-orders");
    const shop = activeShop();

    if (!shop) {
        container.innerHTML =
            '<p class="empty-message">Save your shop profile first.</p>';
        return;
    }

    const orders = state.orders.filter(
        order => order.shopId === shop.id
    );

    if (!orders.length) {
        container.innerHTML =
            '<p class="empty-message">No orders received yet.</p>';
        return;
    }

    container.innerHTML = orders.map(order => {
        const itemsHTML = order.items.map(item => `
            <p>
                ${escapeHTML(item.name)}
                × ${item.quantity}
                — ${money(item.lineTotal)}
            </p>
        `).join("");

        return `
            <article class="order-card">
                <h3>Order #${escapeHTML(order.id.slice(-8))}</h3>

                <p>Customer: ${escapeHTML(order.customerName)}</p>

                <p>Phone: ${escapeHTML(order.customerPhone)}</p>

                <p>Address: ${escapeHTML(order.customerAddress)}</p>

                ${itemsHTML}

                <p>Subtotal: ${money(order.subtotal)}</p>

                <p>Delivery Charge: ${money(order.deliveryCharge)}</p>

                <h3>Total: ${money(order.total)}</h3>

                <p>Payment: Cash on Delivery</p>

                <p>
                    Distance: ${Number(order.distance).toFixed(1)} km
                </p>

                <span class="order-status ${statusClass(order.status)}">
                    ${escapeHTML(order.status)}
                </span>

                <div class="form-group">
                    <label for="status-${escapeHTML(order.id)}">
                        Update Order Status
                    </label>

                    <select
                        id="status-${escapeHTML(order.id)}"
                        data-action="change-status"
                        data-id="${escapeHTML(order.id)}">

                        ${["Pending", "Preparing", "Ready", "Completed"]
                            .map(status => `
                                <option
                                    value="${status}"
                                    ${order.status === status ? "selected" : ""}>
                                    ${status}
                                </option>
                            `).join("")}
                    </select>
                </div>
            </article>
        `;
    }).join("");
}

$("shopkeeper-orders").addEventListener("change", event => {
    const select = event.target.closest(
        'select[data-action="change-status"]'
    );

    if (!select) return;

    const order = state.orders.find(
        item => item.id === select.dataset.id
    );

    if (!order || order.shopId !== state.activeShopId) {
        notify("Order not found.");
        return;
    }

    const allowedStatuses = [
        "Pending",
        "Preparing",
        "Ready",
        "Completed"
    ];

    if (!allowedStatuses.includes(select.value)) {
        notify("Invalid order status.");
        return;
    }

    order.status = select.value;

    saveData();

    renderShopkeeperOrders();
    renderCustomerOrders();

    notify("Order status updated.");
});

// ---------- INITIALIZE ----------

function initializeApp() {
    const year = $("current-year");

    if (year) {
        year.textContent = new Date().getFullYear();
    }

    renderShopProfile();
    renderShops();
    renderProducts();
    renderManageProducts();
    renderCart();
    renderCustomerOrders();
    renderShopkeeperOrders();

    updateCartCount();
}
const imageInput = document.getElementById("productImage");
const scanButton = document.getElementById("scanProducts");
const scanStatus = document.getElementById("scanStatus");
const productTextarea = document.getElementById("bulk-products");

scanButton.addEventListener("click", async () => {
    const file = imageInput.files[0];

    if (!file) {
        scanStatus.textContent = "Please select or capture a photo first.";
        return;
    }

    if (!window.Tesseract) {
        scanStatus.textContent = "OCR library could not load. Check your internet connection.";
        return;
    }

    scanButton.disabled = true;
    scanStatus.textContent = "Reading the product list... Please wait.";

    try {
        const result = await Tesseract.recognize(file, "eng", {
            logger: message => {
                if (message.status === "recognizing text") {
                    scanStatus.textContent =
                        `Scanning: ${Math.round(message.progress * 100)}%`;
                }
            }
        });

        const text = result.data.text.trim();

        if (!text) {
            scanStatus.textContent =
                "No text detected. Try a clearer photo.";
            return;
        }

        productTextarea.value = text;
        scanStatus.textContent =
            "Scan complete! Check product names and prices, then tap Generate Product Cards.";
    } catch (error) {
        scanStatus.textContent =
            "Scanning failed. Try another clear photo.";
    } finally {
        scanButton.disabled = false;
    }
});


initializeApp();

// LocalCart Product Photo Scanner

const photoInput = document.getElementById("productImage");
const scanButton = document.getElementById("scanProducts");
const scanStatus = document.getElementById("scanStatus");
const scannedProducts = document.getElementById("scannedProducts");
const addButton = document.getElementById("addScannedProducts");

// Scan a photo and extract text
scanButton.addEventListener("click", async () => {
    const file = photoInput.files[0];

    if (!file) {
        scanStatus.textContent = "Please take or select a photo first.";
        return;
    }

    if (!window.Tesseract) {
        scanStatus.textContent =
            "Scanner is loading or unavailable. Check your internet connection.";
        return;
    }

    scanButton.disabled = true;
    scanStatus.textContent = "Reading the photo...";

    try {
        const result = await Tesseract.recognize(file, "eng", {
            logger: info => {
                if (info.status === "recognizing text") {
                    scanStatus.textContent =
                        "Scanning: " + Math.round(info.progress * 100) + "%";
                }
            }
        });

        scannedProducts.value = result.data.text
            .split("\n")
            .map(line => line.trim())
            .filter(Boolean)
            .join("\n");

        scanStatus.textContent =
            "Scan complete. Check names and prices before adding.";

    } catch (error) {
        scanStatus.textContent =
            "Scan failed. Please try a clearer photo.";
    } finally {
        scanButton.disabled = false;
    }
});

// Add scanned products using LocalCart's existing product system
addButton.addEventListener("click", () => {
    const lines = scannedProducts.value
        .split("\n")
        .map(line => line.trim())
        .filter(Boolean);

    if (!lines.length) {
        scanStatus.textContent = "No products found.";
        return;
    }

    const confirmAdd = confirm(
        "Add " + lines.length + " scanned lines? Please check prices first."
    );

    if (!confirmAdd) return;

    // Convert each line to: Product Name, Price, Unit
    const formatted = lines.map(line => {
        const parts = line.split(/[,;\t]+/).map(x => x.trim());

        if (parts.length < 2) return null;

        const priceText = parts[1].replace(/[₹,\s]/g, "");
        const price = Number(priceText);

        if (!parts[0] || !Number.isFinite(price) || price < 0) {
            return null;
        }

        const unit = parts.slice(2).join(" ") || "1 unit";

        return {
            name: parts[0],
            price: price,
            unit: unit
        };
    }).filter(Boolean);

    if (!formatted.length) {
        scanStatus.textContent =
            "Could not identify product names and prices. Edit the list into Name, Price, Unit format.";
        return;
    }

    /*
      Your current LocalCart app.js must connect these products
      to its existing shop/product saving system.
      Do not pretend they are saved until that connection is made.
    */

    scanStatus.textContent =
        formatted.length + " products recognized. The final save connection to your existing LocalCart system is still needed.";

    console.log("Scanned products:", formatted);
});
