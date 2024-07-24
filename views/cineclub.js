function myFunction(x) {
	x.classList.toggle("fa-thumbs-down");
	Telegram.WebApp.sendData(new Date().toString());
}
