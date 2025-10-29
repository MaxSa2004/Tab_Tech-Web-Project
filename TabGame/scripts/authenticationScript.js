document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('loginForm');
    const loginBtn = document.getElementById('loginBtn');
    const userBox = document.getElementById('userInfo');
    const userNameText = document.getElementById('userName');
    const logoutBtn = document.getElementById('logoutBtn');

    // safety if elements aren't found
    if (!form || !loginBtn || !userBox || !userNameText || !logoutBtn) return;

    // function to show logged in state
    function showLoggedIn() {
        userNameText.textContent = 'Username: null'; // placeholder username
        form.hidden = true;
        form.style.display = 'none';
        userBox.hidden = false;
        userBox.style.display = '';
    }
    // function to show logged out state
    function showLoggedOut() {
        userBox.hidden = true;
        userBox.style.display = 'none';
        form.hidden = false;
        form.style.display = '';
    }
    // login action (just flipping UI and setting username to null)
    loginBtn.addEventListener('click', (e) => {
        e.preventDefault();
        showLoggedIn();
    });
    // logout action (again, just flipping UI and restoring the form)
    logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        showLoggedOut();
    });
});