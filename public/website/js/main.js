const menuButton = document.getElementById("menuButton");
const mobileMenu = document.getElementById("mobileMenu");

if (menuButton && mobileMenu) {

    menuButton.addEventListener("click", () => {

        mobileMenu.classList.toggle("active");

    });


    mobileMenu
        .querySelectorAll("a")
        .forEach(link => {

            link.addEventListener("click", () => {

                mobileMenu.classList.remove("active");

            });

        });

}


const year = document.getElementById("year");

if (year) {

    year.textContent =
        new Date().getFullYear();

}