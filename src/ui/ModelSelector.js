// ui/ModelSelector.js

import { DropboxService } from "../services/DropboxService";
import { DeviceDetector } from "../utils/DeviceDetector";
import { TableGenerator } from "./TableGenerator";
import { Constants } from "../utils/Constants";

export default class ModelSelector {
    constructor(liverViewer) {
        // Initialize basic properties
        this.liverViewer = liverViewer;
        this.isDarkMode = liverViewer.isDarkMode;
        this.dialog = null;
        this.dropboxService = new DropboxService();
        this.modelLoader = null;
        this.lastLoadedModels = null;
        this.textPanel = null;
        this.patientInfoUrl = null; // Patient information URL saved
        this.lastJsonUrl = null; // JSON URL saved
        this.isLoading = false; // Loading state tracking
        this.currentModelIndex = 0; // Index of currently selected model
        this.lastScrollPosition = 0; // Last carousel scroll position

        // Local file model related properties (Option B)
        this.localModels = []; // Array of locally loaded models
        this.isLocalFilesMode = false; // Whether local file mode is enabled

        // Initialize UI container
        this.container = document.createElement("div");
        this.container.className = "model-selector";
        this.container.style.display = "none";
        document.body.appendChild(this.container);

        // Initialize model list container
        this.modelList = document.createElement("div");
        this.modelList.className = "model-list";
        this.container.appendChild(this.modelList);
        this.tableGenerator = new TableGenerator(this.isDarkMode);

        this.close = this.close.bind(this);
        console.log("ModelSelector initialized:", {
            isDarkMode: this.isDarkMode,
            liverViewer: !!this.liverViewer,
            textPanel: !!this.liverViewer?.textPanel,
        });
    }

    toggleDarkMode() {
        console.log("ModelSelector toggleDarkMode called");
        if (this.liverViewer) {
            this.liverViewer.toggleDarkMode();
            this.tableGenerator.setTheme(this.isDarkMode);
            console.log("Current theme state:", {
                liverViewer: this.liverViewer.isDarkMode,
                modelSelector: this.isDarkMode,
            });
        }
    }

    setModelLoader(modelLoader) {
        console.log("ModelLoader initialized:", modelLoader);
        this.modelLoader = modelLoader;
        if (this.dropboxService) {
            this.dropboxService.setModelLoader(modelLoader);
        }
    }

    // setTextPanel(textPanel) {
    //     this.textPanel = textPanel;
    // }

    async loadDropboxFolderContents(jsonUrl, isDirectLoad = false) {
        try {
            this.lastJsonUrl = jsonUrl;
            console.log("Input URL:", jsonUrl);

            // Dropbox URL validation (dropbox.com or dropboxusercontent.com allowed)
            if (!jsonUrl.includes("dropbox.com") && !jsonUrl.includes("dropboxusercontent.com")) {
                throw new Error("Not a valid Dropbox link.");
            }

            // Load and process JSON file
            // Set isJsonFile=true to auto add model.json path if folder link
            const directUrl = this.dropboxService.getDirectDownloadUrl(jsonUrl, true);
            console.log("Converted JSON URL:", directUrl);
            const response = await fetch(directUrl);
            if (!response.ok) {
                throw new Error("Unable to load JSON file.");
            }

            const data = await response.json();
            console.log("Loaded JSON data:", data);

            // Process logo data - call onJsonLoaded callback if available
            if (
                data.logo &&
                this.liverViewer &&
                typeof this.onJsonLoaded === "function"
            ) {
                console.log("Logo data found, executing callback:", data.logo);
                this.onJsonLoaded(data);
            }

            // Update UI or save data
            // Model list must be updated even when isDirectLoad to display in UI
            await this.updateModelList(data);
            this.lastLoadedModels = data.models || [];

            return data;
        } catch (error) {
            console.error("Error during full processing:", error);
            throw error;
        }
    }

    async handleTableDisplay(model) {
        // Close TextPanel
        if (this.liverViewer.textPanel) {
            this.liverViewer.textPanel.close();
        }

        if (model.tableUrl) {
            try {
                const response = await fetch(
                    this.dropboxService.getDirectDownloadUrl(model.tableUrl)
                );
                const tableText = await response.text();

                let tableHTML = "";

                // Normalize case value (case-insensitive, trim whitespace)
                const normalizedCase = model.case ? model.case.trim().toUpperCase() : "";
                // Also check model name (to distinguish HVT, RL, etc.)
                const modelName = model.name ? model.name.trim().toUpperCase() : "";
                console.log("Table display - model.case:", model.case, "normalized:", normalizedCase, "model.name:", model.name);

                if (normalizedCase === "HCC" || normalizedCase === "CCC" || normalizedCase.includes("CCC")) {
                    // Use HCC table format for CCC too, pass CCC to surgeryType
                    tableHTML = this.tableGenerator.createHCCTable(
                        tableText,
                        normalizedCase === "CCC" || normalizedCase.includes("CCC") ? "CCC" : model.case
                    );
                } else if (normalizedCase === "KT" || normalizedCase === "LDKT") {
                    tableHTML = this.tableGenerator.createKTTable(
                        tableText,
                        model.case
                    );
                } else if (normalizedCase === "LDLT" || normalizedCase === "LDLT RL" || normalizedCase.includes("LDLT")) {
                    // For LDLT, check model name to select left/HVT/RL/5-Section table
                    if (modelName.includes("SECTION") || modelName.includes("5-SECTION")) {
                        // Liver 5-Section Table
                        console.log("Using Liver 5-Section Table (based on model name):", model.name);
                        tableHTML = this.tableGenerator.createLiver5SectionTable(
                            tableText,
                            model.case || "Liver 5-Section"
                        );
                    } else if (modelName.includes("LEFT")) {
                        // Create left model table
                        console.log("Using LDLT left table (based on model name):", model.name);
                        tableHTML = this.tableGenerator.createLeftTable(
                            tableText,
                            model.case || "LDLT"
                        );
                    } else if (modelName.includes("HVT") || modelName.includes("HVt") || modelName.includes("HVT")) {
                        // HVT Table (HTML format)
                        console.log("Using HVT Table (based on model name):", model.name);
                        tableHTML = this.tableGenerator.createHVTTable(
                            tableText,
                            model.case || "LDLT"
                        );
                    } else {
                        // RL Table (default LDLT table)
                        console.log("Using LDLT RL Table (based on model name):", model.name);
                        tableHTML = this.tableGenerator.createLDLTTable(
                            tableText,
                            model.case
                        );
                    }
                } else if (normalizedCase === "HVT" || (normalizedCase.includes("LDLT") && model.case?.toLowerCase().includes("hvt"))) {
                    // case explicitly specifies HVT
                    console.log("Using HVT Table (based on case):", model.case);
                    tableHTML = this.tableGenerator.createHVTTable(
                        tableText,
                        model.case || "LDLT"
                    );
                } else {
                    console.warn("Unknown case type, using HCC table:", model.case);
                    tableHTML = this.tableGenerator.createHCCTable(
                        tableText,
                        model.case || "Unknown"
                    );
                }

                if (this.liverViewer.textPanel) {
                    this.liverViewer.textPanel.updateContent(tableHTML);
                }
            } catch (error) {
                console.error("Failed to load table data:", error);
                if (this.liverViewer.textPanel) {
                    this.liverViewer.textPanel.updateContent("");
                }
            }
        } else {
            if (this.liverViewer.textPanel) {
                this.liverViewer.textPanel.updateContent("");
            }
        }
    }

    extractFolderPath(url) {
        // Extract required information from Dropbox folder URL
        const match = url.match(/\/fo\/([^/]+)/);
        return match ? match[1] : null;
    }

    async updateModelList(data) {
        try {
            // Data validation
            if (!data) {
                return; // Return silently
            }

            // Check model array
            const models = Array.isArray(data) ? data : data.models;
            if (!models || !Array.isArray(models)) {
                return; // Return silently
            }

            // Return silently if container or modelList doesn't exist
            if (!this.container || !this.modelList) {
                return;
            }

            // Initialize existing model list
            this.modelList.innerHTML = "";

            // Process models
            if (!models || !Array.isArray(models)) {
                console.error("Invalid models data:", models);
                return;
            }

            this.lastLoadedModels = models;

            // Remove existing container
            const oldContainer = document.getElementById("model-list");
            if (oldContainer) {
                oldContainer.remove();
            }

            // Create new container
            const container = document.createElement("div");
            container.id = "model-list";

            const isMobile = new DeviceDetector().isMobile();
            const containerWidth = 300; // Original container size
            const cardWidth = (containerWidth / 3) * 1.5; // Reduce card size to 50% of container width

            // Carousel container style
            Object.assign(container.style, {
                display: "flex",
                gap: "0",
                overflowX: "auto",
                overflowY: "hidden",
                width: `${containerWidth}px`,
                boxSizing: "border-box",
                scrollSnapType: "x mandatory", // Restored for normal carousel operation
                position: "relative",
                paddingLeft: `${(containerWidth - cardWidth) / 2}px`,
                paddingRight: `${(containerWidth - cardWidth) / 2}px`,
                scrollbarWidth: "none",
                msOverflowStyle: "none",
                WebkitOverflowScrolling: "touch",
                scrollBehavior: "smooth",
                scrollSnapStop: "always", // Restored for normal carousel operation
            });

            // Update tile definition
            const style = document.createElement("style");
            style.textContent = `
                #model-list::-webkit-scrollbar {
                    display: none;
                }
                .model-item {
                    scroll-snap-align: center; /* Restored for normal carousel operation */
                    transition: all 0.3s ease;
                    opacity: 0.4;
                    transform: scale(0.85);
                    filter: brightness(0.7);
                    background-color: ${
                        this.isDarkMode
                            ? "rgba(255, 255, 255, 0.1)"
                            : "rgba(240, 240, 240, 0.95)"
                    } !important;
                }
                .model-item.active {
                    opacity: 1;
                    transform: scale(1);
                    filter: brightness(1);
                    z-index: 2;
                }
                .pagination-dot {
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    background-color: ${
                        this.isDarkMode
                            ? "rgba(255, 255, 255, 0.3)"
                            : "rgba(0, 0, 0, 0.3)"
                    };
                    transition: all 0.3s ease;
                }
                .pagination-dot.active {
                    background-color: ${
                        this.isDarkMode ? "white" : "rgba(0, 0, 0, 0.9)"
                    };
                    transform: scale(1.2);
                }
                #model-list-title {
                    color: ${
                        this.isDarkMode
                            ? "rgba(255, 255, 255, 0.8)"
                            : "rgba(0, 0, 0, 0.8)"
                    } !important;
                }
            `;
            document.head.appendChild(style);

            // Improve active center item via scroll event
            let scrollTimeout;
            let isScrollDisabled = false; // Scroll event disable flag
            
            const scrollHandler = () => {
                if (scrollTimeout) {
                    clearTimeout(scrollTimeout);
                }

                // Do not process if scroll is disabled
                if (isScrollDisabled) return;

                scrollTimeout = setTimeout(() => {
                    const items = container.querySelectorAll(".model-item");
                    const dots =
                        dotsContainer.querySelectorAll(".pagination-dot");
                    const containerCenter =
                        container.scrollLeft + container.offsetWidth / 2;

                    items.forEach((item, index) => {
                        const itemCenter =
                            item.offsetLeft + item.offsetWidth / 2;
                        const distanceFromCenter = Math.abs(
                            containerCenter - itemCenter
                        );

                        if (distanceFromCenter < item.offsetWidth / 2) {
                            items.forEach((i) => {
                                i.classList.remove("active");
                                i.style.zIndex = "1";
                            });
                            item.classList.add("active");
                            item.style.zIndex = "2";

                            dots.forEach((dot, i) => {
                                if (i === index) {
                                    dot.classList.add("active");
                                    dot.style.backgroundColor = this.isDarkMode
                                        ? "white"
                                        : "black";
                                } else {
                                    dot.classList.remove("active");
                                    dot.style.backgroundColor = this.isDarkMode
                                        ? "rgba(255, 255, 255, 0.3)"
                                        : "rgba(0, 0, 0, 0.3)";
                                }
                            });
                        }
                    });
                }, 50);
            };
            
            container.addEventListener("scroll", scrollHandler);
            
            // Add method to control scroll event
            this.disableScroll = () => { isScrollDisabled = true; };
            this.enableScroll = () => { isScrollDisabled = false; };

            // Add left/right buttons
            const createNavigationButton = (direction) => {
                const button = document.createElement("button");
                
                // Check current theme state from multiple sources
                const liverViewerDarkMode = this.liverViewer ? this.liverViewer.isDarkMode : null;
                const bodyDarkMode = document.body.classList.contains('dark-mode');
                const computedDarkMode = getComputedStyle(document.body).backgroundColor.includes('26, 26, 26');
                const currentIsDarkMode = liverViewerDarkMode !== null ? liverViewerDarkMode : (bodyDarkMode || computedDarkMode);
                
                Object.assign(button.style, {
                    position: "absolute",
                    top: "50%",
                    transform: "translateY(-50%)",
                    [direction]: "5px",
                    backgroundColor: currentIsDarkMode ? "rgba(0, 0, 0, 0.5)" : "rgba(255, 255, 255, 0.8)",
                    color: currentIsDarkMode ? "white" : "black",
                    border: "none",
                    borderRadius: "50%",
                    width: "30px",
                    height: "30px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    zIndex: "3",
                    opacity: "0.7",
                    transition: "opacity 0.3s",
                });

                // Apply Google icon SVG
                const svg = document.createElementNS(
                    "http://www.w3.org/2000/svg",
                    "svg"
                );
                svg.setAttribute("width", "24");
                svg.setAttribute("height", "24");
                svg.setAttribute("viewBox", "0 0 24 24");
                svg.setAttribute("fill", currentIsDarkMode ? "white" : "black");

                const path = document.createElementNS(
                    "http://www.w3.org/2000/svg",
                    "path"
                );
                if (direction === "left") {
                    // chevron_left icon
                    path.setAttribute(
                        "d",
                        "M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"
                    );
                } else {
                    // chevron_right icon
                    path.setAttribute(
                        "d",
                        "M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"
                    );
                }

                svg.appendChild(path);
                button.appendChild(svg);

                button.onmouseover = () => (button.style.opacity = "1");
                button.onmouseleave = () => (button.style.opacity = "0.7");

                return button;
            };

            const wrapper = document.createElement("div");
            Object.assign(wrapper.style, {
                position: "relative",
                width: "100%",
                paddingBottom: "45px",
            });

            const prevButton = createNavigationButton("left");
            const nextButton = createNavigationButton("right");

            // Slide move function
            const moveToItem = (direction) => {
                console.log("moveToItem called:", direction, "Loading state:", this.isLoading);
                
                // Block carousel movement completely if loading
                if (this.isLoading) {
                    console.log("Loading - Block carousel movement completely");
                    return;
                }
                
                // Block carousel movement if model is loading
                if (this.isLoading) {
                    console.log("Model loading - Block carousel movement");
                    return;
                }
                
                const items = container.querySelectorAll(".model-item");
                const dots = dotsContainer.querySelectorAll(".pagination-dot");
                const activeItem =
                    container.querySelector(".model-item.active");
                if (!activeItem) return;

                const currentIndex = Array.from(items).indexOf(activeItem);
                const targetIndex =
                    direction === "next"
                        ? Math.min(currentIndex + 1, items.length - 1)
                        : Math.max(currentIndex - 1, 0);

                // Restore carousel scroll (only when not loading)
                if (!this.isLoading) {
                    items[targetIndex].scrollIntoView({
                        behavior: "smooth",
                        block: "nearest",
                        inline: "center",
                    });
                }

                // Timing adjustment for smooth transition
                setTimeout(() => {
                    // Update dots
                    dots.forEach((dot, i) => {
                        if (i === targetIndex) {
                            dot.classList.add("active");
                            dot.style.backgroundColor = this.isDarkMode
                                ? "white"
                                : "black";
                        } else {
                            dot.classList.remove("active");
                            dot.style.backgroundColor = this.isDarkMode
                                ? "rgba(255, 255, 255, 0.3)"
                                : "rgba(0, 0, 0, 0.3)";
                        }
                    });

                    // Update item active state
                    items.forEach((item, i) => {
                        if (i === targetIndex) {
                            item.classList.add("active");
                            item.style.zIndex = "2";
                        } else {
                            item.classList.remove("active");
                            item.style.zIndex = "1";
                        }
                    });
                }, 100); // Add slight delay
            };

            // Button click event
            prevButton.onclick = () => moveToItem("prev");
            nextButton.onclick = () => moveToItem("next");

            // Touch event handling
            let touchStartX = 0;
            let touchEndX = 0;
            let isSwiping = false;
            this.touchStartTime = 0; // Add touch start time

            container.addEventListener(
                "touchstart",
                (e) => {
                    // Ignore touch event if loading
                    if (this.isLoading) {
                        console.log("Touch start blocked - Loading");
                        isSwiping = false;
                        e.preventDefault();
                        e.stopPropagation();
                        return;
                    }
                    touchStartX = e.touches[0].clientX;
                    this.touchStartTime = Date.now(); // Record touch start time
                    isSwiping = true;
                },
                { passive: false }
            );

            container.addEventListener(
                "touchmove",
                (e) => {
                    if (!isSwiping || this.isLoading) {
                        if (this.isLoading) {
                            console.log("Touch move blocked - Loading");
                            e.preventDefault();
                            e.stopPropagation();
                        }
                        return;
                    }
                    touchEndX = e.touches[0].clientX;
                },
                { passive: false }
            );

            container.addEventListener("touchend", (e) => {
                if (!isSwiping || this.isLoading) {
                    if (this.isLoading) {
                        console.log("Touch end blocked - Loading");
                        e.preventDefault();
                        e.stopPropagation();
                    }
                    return;
                }

                const swipeDistance = touchEndX - touchStartX;
                // Reduce sensitivity on mobile: 50px → 100px, add minimum swipe time
                const minSwipeDistance = this.isMobile ? 100 : 50;
                const swipeTime = Date.now() - this.touchStartTime;
                const minSwipeTime = 200; // Swipe must be at least 200ms
                
                if (Math.abs(swipeDistance) > minSwipeDistance && swipeTime > minSwipeTime) {
                    // Limit swipe speed on mobile (prevent too fast swipe)
                    const swipeSpeed = Math.abs(swipeDistance) / swipeTime;
                    const maxSwipeSpeed = this.isMobile ? 2.0 : 5.0; // px/ms
                    
                    if (swipeSpeed <= maxSwipeSpeed) {
                        console.log(`Swipe detected: distance=${Math.abs(swipeDistance)}px, time=${swipeTime}ms, speed=${swipeSpeed.toFixed(2)}px/ms`);
                        moveToItem(swipeDistance > 0 ? "prev" : "next");
                    } else {
                        console.log(`Swipe ignored: speed is too fast (${swipeSpeed.toFixed(2)}px/ms > ${maxSwipeSpeed}px/ms)`);
                    }
                } else {
                    console.log(`Swipe ignored: distance=${Math.abs(swipeDistance)}px, time=${swipeTime}ms (threshold: ${minSwipeDistance}px, ${minSwipeTime}ms)`);
                }

                isSwiping = false;
            });

            // Key event handling
            document.addEventListener("keydown", (e) => {
                if (this.dialog && !this.isLoading) {
                    if (e.key === "ArrowLeft") {
                        moveToItem("prev");
                    } else if (e.key === "ArrowRight") {
                        moveToItem("next");
                    }
                }
            });

            // Add click event to model card
            models.forEach((model, index) => {
                const item = document.createElement("div");
                item.className = "model-item";
                if (index === 0) item.classList.add("active");

                Object.assign(item.style, {
                    flex: `0 0 ${cardWidth}px`,
                    width: `${cardWidth}px`,
                    backgroundColor: "rgba(255, 255, 255, 0.1)",
                    borderRadius: "8px",
                    cursor: "pointer",
                    overflow: "hidden",
                    display: "flex",
                    flexDirection: "column",
                    marginRight: "-15px", // Show next card slightly
                    position: "relative",
                    zIndex: index === 0 ? "2" : "1",
                    boxShadow: "0 4px 8px rgba(0,0,0,0.2)",
                });

                // Adjust thumbnail container size
                const thumbnailContainer = document.createElement("div");
                Object.assign(thumbnailContainer.style, {
                    width: "100%",
                    height: `${cardWidth}px`, // Keep square aspect ratio
                    backgroundColor: "rgba(0, 0, 0, 0.2)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                });

                if (model.thumbnailUrl) {
                    const img = document.createElement("img");
                    img.src = this.dropboxService.getDirectDownloadUrl(
                        model.thumbnailUrl
                    );
                    Object.assign(img.style, {
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                    });
                    thumbnailContainer.appendChild(img);
                } else {
                    const defaultIcon = document.createElement("div");
                    defaultIcon.innerHTML = "🔲";
                    defaultIcon.style.fontSize = "24px";
                    thumbnailContainer.appendChild(defaultIcon);
                }

                item.appendChild(thumbnailContainer);

                // Text container
                const textContainer = document.createElement("div");
                Object.assign(textContainer.style, {
                    padding: "8px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px",
                });

                const name = document.createElement("div");
                name.textContent = model.name;
                Object.assign(name.style, {
                    fontWeight: "bold",
                    color: this.isDarkMode ? "white" : "black",
                    fontSize: "14px",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                });
                textContainer.appendChild(name);

                if (model.description) {
                    const description = document.createElement("div");
                    description.textContent = model.description;
                    Object.assign(description.style, {
                        fontSize: "12px",
                        color: this.isDarkMode
                            ? "rgba(255, 255, 255, 0.7)"
                            : "rgba(0, 0, 0, 0.7)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                    });
                    textContainer.appendChild(description);
                }

                item.appendChild(textContainer);

                // Modify model click event
                item.addEventListener("click", async (e) => {
                    // Block event propagation (prevent carousel overflow)
                    e.stopPropagation();
                    e.preventDefault();
                    
                    console.log("Model clicked:", model.name, "Active state:", item.classList.contains("active"), "Mobile:", this.isMobile);
                    
                    // Allow model load only for active card (prevent carousel movement)
                    if (item.classList.contains("active")) {
                        // Prevent additional carousel movement on mobile
                        if (this.isMobile) {
                            // Set loading state immediately on mobile
                            this.isLoading = true;
                            console.log("Mobile - Set loading state immediately");
                        }
                        // Block carousel movement completely
                        console.log("Start model loading - Block carousel movement");
                        
                        try {
                            const directGlbUrl = this.dropboxService.getDirectDownloadUrl(model.glbUrl);
                            console.log("Attempting to load model:", directGlbUrl);

                            if (this.liverViewer && this.liverViewer.modelLoader) {
                                // Disable all carousel events
                                if (this.disableScroll) {
                                    this.disableScroll();
                                }
                                
                                // Temporarily disable touch events
                                container.style.pointerEvents = 'none';
                                
                                // Completely disable scroll behavior
                                container.style.scrollBehavior = 'auto';
                                container.style.overflowX = 'hidden';
                                
                                // Start loading state
                                this.isLoading = true;
                                item.classList.add('loading');
                                
                                // Show loading state
                                const loadingIndicator = document.createElement("div");
                                loadingIndicator.textContent = "Loading...";
                                loadingIndicator.style.position = "absolute";
                                loadingIndicator.style.top = "50%";
                                loadingIndicator.style.left = "50%";
                                loadingIndicator.style.transform = "translate(-50%, -50%)";
                                loadingIndicator.style.color = this.isDarkMode ? "white" : "black";
                                item.appendChild(loadingIndicator);

                                // Load model
                                await this.loadModel(directGlbUrl, index);
                                console.log("Model loading successful");

                                // Remove loading indicator
                                loadingIndicator.remove();
                                
                                // End loading state
                                this.isLoading = false;
                                item.classList.remove('loading');
                                
                                // Re-enable all carousel events
                                if (this.enableScroll) {
                                    this.enableScroll();
                                }
                                
                                // Re-enable touch events
                                container.style.pointerEvents = 'auto';
                                
                                // Re-enable scroll behavior
                                container.style.scrollBehavior = 'smooth';
                                container.style.overflowX = 'auto';
                                
                                console.log("Model loading complete - Re-enable carousel events");

                                // Close TextPanel
                                if (this.liverViewer.textPanel) {
                                    this.liverViewer.textPanel.close();
                                }

                                await this.handleTableDisplay(model);

                                // Close ModelSelector
                                this.close();

                                // Update URL (optional)
                                const currentUrl = new URL(window.location.href);
                                currentUrl.searchParams.set("model", model.name);
                                window.history.pushState({}, "", currentUrl);
                            } else {
                                console.error("modelLoader not set");
                                throw new Error("modelLoader not set");
                            }
                        } catch (error) {
                            console.error("Failed to load model:", error);
                            // End loading state (even on error)
                            this.isLoading = false;
                            item.classList.remove('loading');
                            
                            // Re-enable all carousel events (even on error)
                            if (this.enableScroll) {
                                this.enableScroll();
                            }
                            
                            // Re-enable touch events (even on error)
                            container.style.pointerEvents = 'auto';
                            
                            // Re-enable scroll behavior (even on error)
                            container.style.scrollBehavior = 'smooth';
                            container.style.overflowX = 'auto';
                            
                            alert("Failed to load model: " + error.message);
                        }
                    } else {
                        // Inactive card clicked - Remove scroll functionality (prevent carousel overflow)
                        // Allow manual scroll only when user wants
                        console.log("Inactive card clicked - Disable scroll behavior");
                    }
                });

                container.appendChild(item);
            });

            // Modify dots container style
            const dotsContainer = document.createElement("div");
            Object.assign(dotsContainer.style, {
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                gap: "8px",
                position: "absolute",
                bottom: "10px",
                left: "0",
                right: "0",
                height: "20px",
                zIndex: "3",
            });

            // Explicitly write pagination dots generation
            models.forEach((_, index) => {
                const dot = document.createElement("div");
                dot.className = "pagination-dot";
                if (index === 0) dot.classList.add("active");

                // Add individual dot style
                Object.assign(dot.style, {
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    backgroundColor:
                        index === 0 ? "white" : "rgba(255, 255, 255, 0.3)",
                    transition: "all 0.8s cubic-bezier(0.4, 0, 0.2, 1)",
                    cursor: "pointer",
                });

                dotsContainer.appendChild(dot);
            });

            // Check order
            wrapper.appendChild(prevButton);
            wrapper.appendChild(container);
            wrapper.appendChild(nextButton);
            wrapper.appendChild(dotsContainer);
            this.dialog.appendChild(wrapper);

            // Set initial scroll position - Removed to fix carousel issue
            // setTimeout(() => {
            //     const firstItem = container.querySelector(".model-item");
            //     if (firstItem) {
            //         firstItem.scrollIntoView({
            //             behavior: "smooth",
            //             block: "nearest",
            //             inline: "center",
            //         });
            //     }
            // }, 0);

            // Share button
            const shareButton = document.createElement("button");
            Object.assign(shareButton.style, {
                position: "absolute",
                bottom: "20px",
                right: "20px",
                background: "rgba(255, 149, 0, 0.8)",
                border: "none",
                borderRadius: "5px",
                cursor: "pointer",
                padding: "6px 12px",
                display: "flex",
                alignItems: "center",
                gap: "5px",
                color: "white",
                fontSize: "12px",
                zIndex: "10",
                transition: "all 0.2s ease",
            });

            // Share icon and text
            shareButton.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M20.4,21.64H3.6c-1.11,0-2.01-.91-2.01-2.02v-4.29c0-.28.22-.5.5-.5s.5.22.5.5v4.29c0,.56.45,1.02,1.01,1.02h16.8c.56,0,1.01-.46,1.01-1.02v-4.34c0-.28.22-.5.5-.5s.5.22.5.5v4.34c0,1.12-.9,2.02-2.01,2.02Z"/>
                    <g>
                        <path d="M12,19.5c-.28,0-.5-.22-.5-.5V2.86c0-.28.22-.5.5-.5s.5.22.5.5v16.14c0,.28-.22.5-.5.5Z"/>
                        <path d="M16.92,8.51c-.13,0-.26-.05-.36-.15l-4.55-4.77-4.55,4.77c-.19.2-.51.21-.71.02-.2-.19-.21-.51-.02-.71l4.92-5.15c.19-.2.54-.2.72,0l4.92,5.15c.19.2.18.52-.02.71-.1.09-.22.14-.35.14Z"/>
                    </g>
                </svg>
                Share
            `;

            // Add hover effect
            shareButton.onmouseover = () => {
                shareButton.style.background = "rgba(255, 149, 0, 1)";
                shareButton.style.transform = "scale(1.05)";
            };
            shareButton.onmouseleave = () => {
                shareButton.style.background = "rgba(255, 149, 0, 0.8)";
                shareButton.style.transform = "scale(1)";
            };

            // Click event
            shareButton.onclick = async () => {
                if (this.lastJsonUrl) {
                    this.createShareableLink(this.lastJsonUrl);
                } else {
                    alert("No model loaded to share.");
                }
            };

            this.dialog.appendChild(shareButton);
        } catch (error) {
            // Log output only in development mode
            if (process.env.NODE_ENV === "development") {
                console.debug("Error updating model list:", error);
            }
        }
    }

    show() {
        if (this.dialog) {
            return;
        }

        // Variable to preserve carousel scroll position
        this.savedScrollPosition = 0;

        // Check current theme state (from multiple sources)
        const liverViewerDarkMode = this.liverViewer ? this.liverViewer.isDarkMode : null;
        const bodyDarkMode = document.body.classList.contains('dark-mode');
        const computedDarkMode = getComputedStyle(document.body).backgroundColor.includes('26, 26, 26');
        
        this.isDarkMode = liverViewerDarkMode !== null ? liverViewerDarkMode : (bodyDarkMode || computedDarkMode);
        console.log("ModelSelector show - current theme:", this.isDarkMode, {
            liverViewerDarkMode,
            bodyDarkMode,
            computedDarkMode
        });

        // Scroll carousel to current selected model position
        if (this.lastLoadedModels && this.currentModelIndex >= 0) {
            console.log("Scrolling to current model index:", this.currentModelIndex);
            // Set carousel position after slight delay
            setTimeout(() => {
                const container = document.querySelector('#model-list');
                if (container && this.lastLoadedModels.length > this.currentModelIndex) {
                    const cardWidth = this.isMobile ? 120 : 150;
                    const scrollPosition = this.currentModelIndex * cardWidth;
                    container.scrollLeft = scrollPosition;
                    console.log("Carousel scrolled to position:", scrollPosition);
                }
            }, 100);
        }

        const bgColor = this.isDarkMode
            ? "rgba(0, 0, 0, 0.9)"
            : "rgba(245, 245, 245, 0.95)";
        const textColor = this.isDarkMode ? "white" : "black";

        this.dialog = document.createElement("div");
        Object.assign(this.dialog.style, {
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            backgroundColor: this.isDarkMode
                ? "rgba(40, 40, 40, 0.95)"
                : "rgba(255, 255, 255, 0.95)",
            padding: "20px",
            borderRadius: "10px",
            zIndex: "1001",
            color: textColor,
            minWidth: "300px",
            boxShadow: this.isDarkMode
                ? "0 0 10px rgba(0, 0, 0, 0.5)"
                : "0 0 10px rgba(0, 0, 0, 0.2)",
            transition: "all 0.3s ease",
        });

        // Close button
        const closeButton = document.createElement("button");
        closeButton.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${textColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
        `;
        Object.assign(closeButton.style, {
            position: "absolute",
            top: "10px",
            right: "10px",
            background: "none",
            border: "none",
            color: textColor,
            cursor: "pointer",
            padding: "5px",
        });
        closeButton.onclick = this.close;
        this.dialog.appendChild(closeButton);

        // Title
        const title = document.createElement("h3");
        title.textContent = "Import 3D model";
        title.style.marginBottom = "20px";
        title.style.color = textColor;
        this.dialog.appendChild(title);

        // Dropbox link input field
        const inputContainer = document.createElement("div");
        Object.assign(inputContainer.style, {
            marginBottom: "20px",
            display: "flex",
            gap: "8px",
            alignItems: "center",
        });

        const input = document.createElement("input");
        Object.assign(input.style, {
            flex: "1",
            height: "32px",
            padding: "0 12px",
            backgroundColor: this.isDarkMode
                ? "rgba(255, 255, 255, 0.1)"
                : "rgba(0, 0, 0, 0.05)",
            border: this.isDarkMode
                ? "1px solid rgba(255, 255, 255, 0.3)"
                : "1px solid rgba(0, 0, 0, 0.2)",
            borderRadius: "4px",
            color: textColor,
            fontSize: "13px",
        });
        input.placeholder = "paste dropbox link";

        const loadButton = document.createElement("button");
        loadButton.textContent = "Load";
        Object.assign(loadButton.style, {
            height: "32px",
            padding: "0 16px",
            backgroundColor: "#764ba2",
            border: "none",
            borderRadius: "4px",
            color: "white",
            cursor: "pointer",
        });

        inputContainer.appendChild(input);
        inputContainer.appendChild(loadButton);
        
        // Detect share mode - URL parameters or JSON already loaded
        const urlParams = new URLSearchParams(window.location.search);
        const isShared = urlParams.get("shared") === "true" || urlParams.get("readonly") === "true" || this.lastJsonUrl;
        
        // Hide input container if in share mode
        if (isShared) {
            inputContainer.style.display = "none";
        }
        
        this.dialog.appendChild(inputContainer);

        // 구분선
        const divider = document.createElement("div");
        divider.style.borderTop = this.isDarkMode
            ? "1px solid rgba(255, 255, 255, 0.3)"
            : "1px solid rgba(0, 0, 0, 0.8)";
        divider.style.margin = "20px 0";
        this.dialog.appendChild(divider);

        // 기존 모델 목록
        const listTitle = document.createElement("h4");
        listTitle.id = "model-list-title";
        listTitle.textContent = "3D model list";
        Object.assign(listTitle.style, {
            fontSize: "14px",
            color: this.isDarkMode
                ? "rgba(255, 255, 255, 0.8)"
                : "rgba(0, 0, 0, 0.8)",
            fontWeight: "500",
            margin: "0 0 20px 0",
            padding: "0",
        });

        this.dialog.appendChild(listTitle);

        // 마지막으로 로드된 모델이 있다면 보여주기
        if (this.lastLoadedModels) {
            this.updateModelList(this.lastLoadedModels);
        }

        document.body.appendChild(this.dialog);

        // 테마 적용을 위한 스타일 시트 추가
        this.updateTheme(this.isDarkMode);

        // 이벤트 리스너
        loadButton.onclick = async () => {
            const url = input.value.trim();
            if (url) {
                try {
                    loadButton.disabled = true;
                    loadButton.textContent = "loading...";
                    await this.loadDropboxFolderContents(url);
                } catch (error) {
                    console.error("파일 로드 중 오류:", error);
                    alert(error.message || "파일을 로드하는데 실패했습니다.");
                } finally {
                    loadButton.disabled = false;
                    loadButton.textContent = "load";
                }
            }
        };
    }

    convertDropboxLink(url) {
        try {
            if (url.includes("dropbox.com")) {
                const match = url.match(/\/([a-z0-9]+)\/([^?]+)/i);
                if (!match) {
                    throw new Error("Invalid Dropbox URL format");
                }

                const fileId = match[1];
                const filePath = decodeURIComponent(match[2]);

                // 새로 형식의 직접 다운로드 URL 생성
                const directLink = `https://dl.dropboxusercontent.com/scl/fi/${fileId}/${filePath}`;
                console.log("변환된 Dropbox 링크:", directLink);
                return directLink;
            }
            return url;
        } catch (error) {
            console.error("Error converting Dropbox link:", error);
            return url;
        }
    }

    getModelName(path) {
        return path.split("/").pop().replace(".glb", "");
    }

    close() {
        try {
            if (this.dialog && document.body.contains(this.dialog)) {
                // carousel 스크롤 위치 보존을 위한 지연
                setTimeout(() => {
                    // 🔴 제거 전에 다시 한 번 존재 여부 확인
                    if (this.dialog && this.dialog.parentNode) {
                        this.dialog.parentNode.removeChild(this.dialog);
                    }
                    this.dialog = null;
                    
                    // carousel 스크롤 위치 복원
                    if (this.savedScrollPosition !== undefined) {
                        const container = document.querySelector('#model-list');
                        if (container) {
                            container.scrollLeft = this.savedScrollPosition;
                        }
                    }
                }, 50);
            }
        } catch (error) {
            console.error("Error closing dialog:", error);
        }
    }

    async loadModel(modelUrl, modelIndex = null) {
        console.log("loadModel called with URL:", modelUrl, "modelIndex:", modelIndex);

        try {
            // 현재 선택된 모델 인덱스 저장
            if (modelIndex !== null) {
                this.currentModelIndex = modelIndex;
                console.log("Current model index saved:", this.currentModelIndex);
            }

            // 드롭박스 URL인 경우, 폴더 URL 추출 시도
            // modelUrl이 드롭박스 공유 링크인 경우 lastJsonUrl 업데이트
            if (modelUrl && (modelUrl.includes('dropbox.com') || modelUrl.includes('dropboxusercontent.com'))) {
                try {
                    // 개별 파일 URL에서 폴더 URL 추출
                    const url = new URL(modelUrl);
                    const pathParts = url.pathname.split('/').filter(part => part);
                    const sclIndex = pathParts.indexOf('scl');
                    if (sclIndex !== -1) {
                        const sclType = pathParts[sclIndex + 1]; // 'fo' 또는 'fi'
                        if (sclType === 'fo' || sclType === 'fi') {
                            const folderId = pathParts[sclIndex + 2];
                            if (folderId) {
                                // 폴더 URL 생성 (model.json이 있는 폴더)
                                const folderUrl = `https://www.dropbox.com/scl/${sclType}/${folderId}/?dl=0`;
                                
                                // lastJsonUrl이 없거나 다른 폴더인 경우에만 업데이트
                                if (!this.lastJsonUrl || !this.lastJsonUrl.includes(folderId)) {
                                    this.lastJsonUrl = folderUrl;
                                    console.log("📋 lastJsonUrl 업데이트 (모델 URL에서 추출):", this.lastJsonUrl);
                                }
                            }
                        }
                    }
                } catch (error) {
                    console.warn("모델 URL에서 폴더 URL 추출 실패:", error);
                }
            }

            if (this.liverViewer && this.liverViewer.modelLoader) {
                console.log("Starting model load");
                await this.liverViewer.modelLoader.loadModel(modelUrl);
                console.log("Model loaded successfully");

                // 카메라 상태 기록기는 삭제되었으므로 제거
                // if (this.liverViewer.controlManager && this.liverViewer.controlManager.getCameraStateRecorder) {
                //     const recorder = this.liverViewer.controlManager.getCameraStateRecorder();
                //     if (recorder) {
                //         recorder.setModelSelector(this);
                //         recorder.updateDropboxUrl();
                //     }
                // }

                console.log("Model and patient info load completed");
                
                this.close();
            } else {
                console.error("ModelLoader not available:", {
                    hasLiverViewer: !!this.liverViewer,
                    hasModelLoader: !!this.liverViewer?.modelLoader,
                });
                throw new Error("modelLoader가 설정되지 않았습니다.");
            }
        } catch (error) {
            console.error("Model load failed:", error);
            console.error("Error details:", {
                message: error.message,
                stack: error.stack,
            });
            alert("모델을 로드하는데 실패했습니다: " + error.message);
        }
    }

    updateTheme(isDarkMode) {
        console.log("ModelSelector updateTheme called with isDarkMode:", isDarkMode);
        // 항상 상태 업데이트
        this.isDarkMode = isDarkMode;
        console.log("ModelSelector isDarkMode updated to:", this.isDarkMode);

        if (this.dialog && this.dialog.isConnected) {
            // Import 3D Model 제목 업데이트
            const importTitle = this.dialog.querySelector("h3");
            if (importTitle) {
                importTitle.style.color = isDarkMode ? "#ffffff" : "#000000";
            }

            // 3D Model List 제목 업데이트 - 이 부분을 수정
            const modelListTitle = this.dialog.querySelector(
                "#model-list-title, .model-list-title"
            );
            if (modelListTitle) {
                modelListTitle.style.color = isDarkMode ? "#ffffff" : "#000000";
            }

            // Dropbox URL 입력 필드 업데이트
            const urlInput = this.dialog.querySelector("input");
            if (urlInput) {
                Object.assign(urlInput.style, {
                    backgroundColor: isDarkMode ? "#333" : "#fff",
                    color: isDarkMode ? "#fff" : "#000",
                    border: `1px solid ${isDarkMode ? "#444" : "#ddd"}`,
                });
            }

            // 1. 모델 아이템 업데이트
            const modelItems = this.dialog.querySelectorAll(".model-item");
            modelItems.forEach((item) => {
                // 배경색 업데이트
                item.style.backgroundColor = isDarkMode
                    ? "rgba(20, 20, 20, 0.95)"
                    : "rgba(240, 240, 240, 0.95)";

                // 구분선 업데이트
                item.style.borderBottom = `1px solid ${
                    isDarkMode
                        ? "rgba(255, 255, 255, 0.1)"
                        : "rgba(0, 0, 0, 0.1)"
                }`;

                // 모델 카드 내 모든 텍스트 요소 찾기
                const textElements = item.querySelectorAll(
                    ".model-name, .model-description, div"
                );
                textElements.forEach((element) => {
                    if (element.classList.contains("model-name")) {
                        element.style.color = isDarkMode
                            ? "#ffffff"
                            : "#000000";
                    } else if (
                        element.classList.contains("model-description")
                    ) {
                        element.style.color = isDarkMode
                            ? "rgba(255, 255, 255, 0.7)"
                            : "rgba(0, 0, 0, 0.7)";
                    } else {
                        // 기타 텍스트 요소
                        element.style.color = isDarkMode
                            ? "#ffffff"
                            : "#000000";
                    }
                });
            });

            // 2. 페이지네이션 닷 업데이트
            const dots = this.dialog.querySelectorAll(".pagination-dot");
            dots.forEach((dot) => {
                if (dot.classList.contains("active")) {
                    dot.style.backgroundColor = isDarkMode
                        ? "#ffffff"
                        : "#000000";
                } else {
                    dot.style.backgroundColor = isDarkMode
                        ? "rgba(255, 255, 255, 0.3)"
                        : "rgba(0, 0, 0, 0.3)";
                }
            });

            // 3. 다이얼로그 배경색 업데이트
            this.dialog.style.backgroundColor = isDarkMode
                ? "rgba(20, 20, 20, 0.95)"
                : "rgba(240, 240, 240, 0.95)";

            // 4. 닫기 버튼 색상 업데이트
            const closeButton = this.dialog.querySelector("button svg");
            if (closeButton) {
                const lines = closeButton.querySelectorAll("line");
                lines.forEach((line) => {
                    line.setAttribute(
                        "stroke",
                        isDarkMode ? "#ffffff" : "#000000"
                    );
                });
            }

            // 5. Navigation 버튼 완전 재생성
            const existingNavButtons = this.dialog.querySelectorAll("button[data-nav-direction]");
            existingNavButtons.forEach(button => button.remove());
            
                         // 새로운 navigation 버튼 생성
             const createNavButton = (direction) => {
                 const button = document.createElement("button");
                 button.setAttribute("data-nav-direction", direction);
                 const currentIsDarkMode = isDarkMode || (this.liverViewer && this.liverViewer.isDarkMode);
                 
                 Object.assign(button.style, {
                     position: "absolute",
                     top: "50%",
                     transform: "translateY(-50%)",
                     [direction]: "5px",
                     backgroundColor: currentIsDarkMode ? "rgba(0, 0, 0, 0.5)" : "rgba(255, 255, 255, 0.8)",
                     color: currentIsDarkMode ? "white" : "black",
                     border: "none",
                     borderRadius: "50%",
                     width: "30px",
                     height: "30px",
                     display: "flex",
                     alignItems: "center",
                     justifyContent: "center",
                     cursor: "pointer",
                     zIndex: "3",
                     opacity: "0.7",
                     transition: "opacity 0.3s",
                 });

                 const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
                 svg.setAttribute("width", "24");
                 svg.setAttribute("height", "24");
                 svg.setAttribute("viewBox", "0 0 24 24");
                 svg.setAttribute("fill", currentIsDarkMode ? "white" : "black");

                 const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
                 path.setAttribute("fill", currentIsDarkMode ? "white" : "black");
                
                if (direction === "left") {
                    path.setAttribute("d", "M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z");
                } else {
                    path.setAttribute("d", "M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z");
                }

                svg.appendChild(path);
                button.appendChild(svg);
                
                // 이벤트 핸들러 추가
                button.onmouseover = () => (button.style.opacity = "1");
                button.onmouseleave = () => (button.style.opacity = "0.7");
                button.onclick = () => {
                    const container = this.dialog.querySelector('#model-list');
                    const items = container.querySelectorAll(".model-item");
                    const activeItem = container.querySelector(".model-item.active");
                    if (!activeItem) return;

                    const currentIndex = Array.from(items).indexOf(activeItem);
                    const targetIndex = direction === "left" 
                        ? Math.max(currentIndex - 1, 0)
                        : Math.min(currentIndex + 1, items.length - 1);

                    // 로딩 중이 아닐 때만 carousel 이동
                    if (!this.isLoading) {
                        items[targetIndex].scrollIntoView({
                            behavior: "smooth",
                            block: "nearest",
                            inline: "center"
                        });
                    }
                };

                return button;
            };

            // navigation 버튼들을 적절한 위치에 추가
            const modelListContainer = this.dialog.querySelector('#model-list');
            if (modelListContainer) {
                const leftButton = createNavButton("left");
                const rightButton = createNavButton("right");
                
                modelListContainer.parentElement.appendChild(leftButton);
                modelListContainer.parentElement.appendChild(rightButton);
            }

            console.log("Theme update completed:", {
                isDarkMode,
                itemsUpdated: modelItems.length,
                dotsUpdated: dots.length,
            });
        }
    }

    createModelItem(model, index) {
        const item = document.createElement("div");
        item.className = "model-item";

        const content = document.createElement("div");
        content.style.padding = "20px";

        const name = document.createElement("div");
        name.className = "model-name";
        name.textContent = model.name;
        name.style.color = this.isDarkMode ? "#ffffff" : "#000000"; // 명확한 색상값 사용
        name.style.fontSize = "16px";
        name.style.fontWeight = "bold";
        name.style.marginBottom = "8px";

        const description = document.createElement("div");
        description.className = "model-description";
        description.textContent = model.description;
        description.style.color = this.isDarkMode
            ? "rgba(255, 255, 255, 0.7)"
            : "rgba(0, 0, 0, 0.7)"; // 명확한 색상값 사용
        description.style.fontSize = "14px";

        content.appendChild(name);
        content.appendChild(description);
        item.appendChild(content);

        return item;
    }

    // 공유 가능한 링크 생성
    createShareableLink(jsonUrl) {
        const baseUrl = window.location.origin;
        const encodedJsonUrl = encodeURIComponent(jsonUrl);

        // 기본 공유 URL 생성
        const shareUrl = `${baseUrl}/?json=${encodedJsonUrl}`;

        console.log("Creating shareable link...");
        console.log("JSON URL:", jsonUrl);
        console.log("Generated share link:", shareUrl);

        this.showShareDialog(shareUrl);
    }

    // 공유 다이얼로그 표시
    showShareDialog(fullUrl) {
        const dialog = document.createElement("div");
        dialog.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
        `;

        const content = document.createElement("div");
        content.style.cssText = `
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 30px;
            border-radius: 15px;
            max-width: 600px;
            width: 90%;
            max-height: 80vh;
            overflow-y: auto;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
            color: white;
        `;

        content.innerHTML = `
            <div style="text-align: center; margin-bottom: 25px;">
                <h2 style="margin: 0 0 10px 0; color: white; font-size: 24px; font-weight: 300;">LiverAiz3D</h2>
                <p style="margin: 0; color: rgba(255, 255, 255, 0.8); font-size: 14px;">3D Model Viewer - Share Link</p>
            </div>
            
            <div style="margin-bottom: 25px;">
                <label style="display: block; margin-bottom: 8px; font-weight: 500; color: white; font-size: 14px;">SHARE LINK:</label>
                <div style="display: flex; gap: 10px;">
                    <input type="text" value="${fullUrl}" readonly style="flex: 1; padding: 12px; border: none; border-radius: 8px; background: rgba(255, 255, 255, 0.9); color: #333; font-size: 14px;">
                    <button onclick="navigator.clipboard.writeText('${fullUrl}').then(() => alert('Link copied!'))" style="padding: 12px 20px; background: rgba(255, 255, 255, 0.2); color: white; border: 1px solid rgba(255, 255, 255, 0.3); border-radius: 8px; cursor: pointer; font-weight: 500; transition: all 0.3s ease;">COPY</button>
                </div>
            </div>
            
            <div style="text-align: center;">
                <button onclick="this.closest('.share-dialog').remove()" style="padding: 12px 30px; background: rgba(255, 255, 255, 0.2); color: white; border: 1px solid rgba(255, 255, 255, 0.3); border-radius: 8px; cursor: pointer; font-weight: 500; transition: all 0.3s ease;">CLOSE</button>
            </div>
        `;

        content.className = "share-dialog";
        dialog.appendChild(content);
        document.body.appendChild(dialog);

        // 배경 클릭시 닫기
        dialog.addEventListener("click", (e) => {
            if (e.target === dialog) {
                dialog.remove();
            }
        });
    }

    /**
     * Open folder or multiple file selection dialog
     * If local models already exist, redisplay model list without folder selection
     */
    openFolderDialog() {
        console.log('[ModelSelector] openFolderDialog called');
        console.log('[ModelSelector] this.localModels.length:', this.localModels.length);
        
        // If local models are already loaded, redisplay model list
        if (this.localModels && this.localModels.length > 0) {
            console.log('[ModelSelector] Redisplay existing local model list');
            this.displayLocalModelList();
            return;
        }
        
        // If no local models, open folder selection dialog
        console.log('[ModelSelector] this.modelLoader:', this.modelLoader);
        if (this.modelLoader) {
            console.log('[ModelSelector] Calling modelLoader.openFolderDialog');
            this.modelLoader.openFolderDialog();
        } else {
            console.warn('[ModelSelector] modelLoader is not available');
        }
    }

    openMultiFileDialog() {
        if (this.modelLoader) {
            this.modelLoader.openMultiFileDialog();
        }
    }

    /**
     * Process models loaded from local folder/files
     * @param {Array} preparedModels - Model array prepared from LocalFileManager
     */
    async loadLocalModels(preparedModels) {
        console.log('[ModelSelector] Load local models:', preparedModels.length, 'items');
        this.localModels = preparedModels;
        this.isLocalFilesMode = true;

        // 모델 리스트 업데이트
        await this.displayLocalModelList();
    }

    /**
     * 로컬 모델 리스트를 UI에 표시
     */
    async displayLocalModelList() {
        try {
            // Close existing dialog
            if (this.dialog) {
                this.close();
            }

            // Create new dialog
            this.dialog = document.createElement("div");
            this.dialog.className = "model-selector-dialog local-folder-mode";
            this.dialog.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: ${this.isDarkMode ? '#2a2a2a' : '#ffffff'};
                border: 1px solid ${this.isDarkMode ? '#444444' : '#cccccc'};
                border-radius: 12px;
                padding: 30px;
                max-width: 600px;
                max-height: 600px;
                overflow-y: auto;
                z-index: 10000;
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
            `;

            // Header
            const header = document.createElement('div');
            header.style.cssText = `
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 20px;
                padding-bottom: 15px;
                border-bottom: 2px solid ${this.isDarkMode ? '#444444' : '#eeeeee'};
            `;
            header.innerHTML = `
                <h2 style="margin: 0; color: ${this.isDarkMode ? '#e6e6e6' : '#2c3e50'};font-size: 20px;">Local Model List</h2>
                <button onclick="this.closest('.model-selector-dialog').remove()" style="
                    background: transparent;
                    border: none;
                    color: ${this.isDarkMode ? '#999' : '#666'};
                    font-size: 24px;
                    cursor: pointer;
                    padding: 0;
                    width: 30px;
                    height: 30px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                ">×</button>
            `;
            this.dialog.appendChild(header);

            // Info text
            const info = document.createElement('div');
            info.style.cssText = `
                font-size: 14px;
                color: ${this.isDarkMode ? '#aaa' : '#666'};
                margin-bottom: 20px;
            `;
            info.textContent = `Total ${this.localModels.length} models loaded. (Automatically grouped by filename)`;
            this.dialog.appendChild(info);

            // Model list container
            const modelListContainer = document.createElement('div');
            modelListContainer.style.cssText = `
                display: grid;
                grid-template-columns: 1fr;
                gap: 12px;
            `;

            // Display each model as a button
            for (const model of this.localModels) {
                const modelButton = document.createElement('div');
                modelButton.className = 'local-model-button';
                modelButton.dataset.modelId = model.id;
                modelButton.style.cssText = `
                    padding: 15px;
                    background: ${this.isDarkMode ? '#3a3a3a' : '#f5f5f5'};
                    border: 2px solid transparent;
                    border-radius: 8px;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                `;

                modelButton.onmouseover = () => {
                    modelButton.style.background = this.isDarkMode ? '#4a4a4a' : '#efefef';
                    modelButton.style.borderColor = Constants.COLORS.PRIMARY_ACCENT;
                };

                modelButton.onmouseout = () => {
                    modelButton.style.background = this.isDarkMode ? '#3a3a3a' : '#f5f5f5';
                    modelButton.style.borderColor = 'transparent';
                };

                // Model info (left)
                const modelInfo = document.createElement('div');
                modelInfo.style.cssText = `
                    flex: 1;
                `;

                const modelName = document.createElement('div');
                modelName.style.cssText = `
                    font-weight: 600;
                    color: ${this.isDarkMode ? '#e6e6e6' : '#2c3e50'};
                    font-size: 15px;
                    margin-bottom: 5px;
                `;
                modelName.textContent = model.name;
                modelInfo.appendChild(modelName);

                const modelMeta = document.createElement('div');
                modelMeta.style.cssText = `
                    font-size: 12px;
                    color: ${this.isDarkMode ? '#999' : '#999'};
                `;
                modelMeta.textContent = `${model.csvFile ? '📊 CSV' : ''}${model.imageFile ? ' 📷 Image' : ''}`.trim() || '3D Model';
                modelInfo.appendChild(modelMeta);

                // Model thumbnail (right)
                const modelThumbnail = document.createElement('div');
                modelThumbnail.style.cssText = `
                    width: 60px;
                    height: 60px;
                    background: ${this.isDarkMode ? '#2a2a2a' : '#e0e0e0'};
                    border-radius: 6px;
                    margin-left: 15px;
                    overflow: hidden;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                `;

                if (model.imageUrl) {
                    modelThumbnail.style.backgroundImage = `url(${model.imageUrl})`;
                    modelThumbnail.style.backgroundSize = 'cover';
                    modelThumbnail.style.backgroundPosition = 'center';
                } else {
                    modelThumbnail.innerHTML = '📦';
                    modelThumbnail.style.fontSize = '24px';
                }

                modelButton.appendChild(modelInfo);
                modelButton.appendChild(modelThumbnail);

                // Click event
                modelButton.onclick = () => this.selectLocalModel(model);

                modelListContainer.appendChild(modelButton);
            }

            this.dialog.appendChild(modelListContainer);

            // Action buttons (bottom)
            const actions = document.createElement('div');
            actions.style.cssText = `
                display: flex;
                gap: 10px;
                margin-top: 20px;
                padding-top: 15px;
                border-top: 1px solid ${this.isDarkMode ? '#444444' : '#e0e0e0'};
            `;

            const moreFilesBtn = document.createElement('button');
            moreFilesBtn.textContent = '+ Load Another Folder';
            moreFilesBtn.style.cssText = `
                flex: 1;
                padding: 10px;
                background: ${Constants.COLORS.SECONDARY_ACCENT};
                color: white;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                font-size: 14px;
                font-weight: 600;
                transition: opacity 0.3s ease;
            `;
            moreFilesBtn.onmouseover = () => moreFilesBtn.style.opacity = '0.8';
            moreFilesBtn.onmouseout = () => moreFilesBtn.style.opacity = '1';
            moreFilesBtn.onclick = () => {
                // Close dialog and start selecting new folder
                if (this.dialog) {
                    this.dialog.remove();
                    this.dialog = null;
                }
                // Open new folder selection dialog
                if (this.modelLoader) {
                    this.modelLoader.openFolderDialog();
                }
            };

            actions.appendChild(moreFilesBtn);
            this.dialog.appendChild(actions);

            document.body.appendChild(this.dialog);

            // Background click close event
            this.dialog.addEventListener('click', (e) => {
                if (e.target === this.dialog) {
                    this.close();
                }
            });

        } catch (error) {
            console.error('[ModelSelector] Error displaying local model list:', error);
        }
    }

    /**
     * Local model selection and loading
     * @param {Object} model - Selected model information
     */
    async selectLocalModel(model) {
        try {
            console.log('[ModelSelector] Local model selected:', model.name);

            // Close dialog
            if (this.dialog) {
                this.dialog.remove();
                this.dialog = null;
            }

            // Load model from ModelLoader
            if (this.modelLoader) {
                await this.modelLoader.loadModelFromLocal(model);
            }

            // Display CSV table (if exists)
            if (model.csvData) {
                this.displayLocalModelTable(model);
            }

        } catch (error) {
            console.error('[ModelSelector] Local model selection error:', error);
            alert('Error occurred while loading model: ' + error.message);
        }
    }

    /**
     * 로컬 모델의 CSV 테이블 표시
     * @param {Object} model - 모델 정보 (csvData, surgeryType 포함)
     */
    displayLocalModelTable(model) {
        try {
            if (!model.csvData || !window.liverViewer || !window.liverViewer.textPanel) {
                console.warn('[ModelSelector] TextPanel or CSV data not found');
                return;
            }

            // Use autoCreateTable method from TableGenerator - Auto detection based on filename
            const result = this.tableGenerator.autoCreateTable(model.csvData, model.name);
            const tableHTML = result.html;
            const surgeryType = result.surgeryType;

            console.log(`[ModelSelector] CSV table created: ${model.name} (Type: ${surgeryType})`);

            // Display in TextPanel (updateContent automatically opens the panel)
            window.liverViewer.textPanel.updateContent(tableHTML);

        } catch (error) {
            console.error('[ModelSelector] Error displaying local model table:', error);
        }
    }
}
