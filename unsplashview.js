function getUnsplashView(imageLink, quote, author) {
	return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Raleway:ital,wght@0,100..900;1,100..900&display=swap" rel="stylesheet">
    <title>Quote Display</title>
    <style>
         body, html {
            height: 100%;
            margin: 0;
            font-family: "Raleway", sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            text-align: center;
            background-image: url('${imageLink}');
            background-size: cover;
            background-position: center;
            background-repeat: no-repeat;
        }
        .quote-container {
            background-color: rgba(0, 0, 0, 0.35);
            padding: 20px;
            border-radius: 10px;
            color: white;
            width: 80%; 
            height: 50%; 
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
        }
        .quote {
            font-size: calc(2em + 2vw); 
            margin-bottom: 20px;
            flex-grow: 1;
            display: flex;
            justify-content: center;
            align-items: center;
        }
        .author {
            font-size: calc(1em + 1vw); 
            text-align: right;
            align-self: flex-end;
            margin-top: -10px;
        }
    </style>
</head>
<body>
    <div class="quote-container">
        <div class="quote">${quote}</div>
        <div class="author">-${author}</div>
    </div>
</body>
</html>
`;
}

module.exports = { getUnsplashView };
