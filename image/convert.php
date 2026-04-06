<?php
// convert.php - Script de conversion automatique JPG/PNG → WebP

$sourceDir = __DIR__ . '/a-convertir/';
$targetDir = __DIR__ . '/uploads/';
$quality = 80;

if (!file_exists($targetDir)) {
    mkdir($targetDir, 0777, true);
}

$converted = 0;
$errors = 0;
$messages = [];

function convertToWebP($source, $target, $quality) {
    $type = exif_imagetype($source);
    $image = null;
    
    if ($type == IMAGETYPE_JPEG) {
        $image = imagecreatefromjpeg($source);
    } elseif ($type == IMAGETYPE_PNG) {
        $image = imagecreatefrompng($source);
        imagepalettetotruecolor($image);
        imagealphablending($image, true);
        imagesavealpha($image, true);
    }
    
    if ($image) {
        imagewebp($image, $target, $quality);
        imagedestroy($image);
        return true;
    }
    return false;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_FILES['photos'])) {
    $files = $_FILES['photos'];
    
    for ($i = 0; $i < count($files['name']); $i++) {
        if ($files['error'][$i] === UPLOAD_ERR_OK) {
            $tmpName = $files['tmp_name'][$i];
            $originalName = $files['name'][$i];
            $extension = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));
            
            if (in_array($extension, ['jpg', 'jpeg', 'png'])) {
                $filename = pathinfo($originalName, PATHINFO_FILENAME);
                $filename = preg_replace('/[^a-zA-Z0-9_-]/', '', $filename);
                $targetFile = $targetDir . $filename . '.webp';
                
                if (convertToWebP($tmpName, $targetFile, $quality)) {
                    $converted++;
                    $messages[] = "✅ Converti : $originalName → $filename.webp";
                } else {
                    $errors++;
                    $messages[] = "❌ Erreur : $originalName";
                }
            } else {
                $errors++;
                $messages[] = "❌ Format non supporté : $originalName";
            }
        }
    }
}

if (isset($_GET['scan'])) {
    $files = glob($sourceDir . '*.{jpg,jpeg,png}', GLOB_BRACE);
    
    foreach ($files as $file) {
        $filename = pathinfo($file, PATHINFO_FILENAME);
        $target = $targetDir . $filename . '.webp';
        
        if (convertToWebP($file, $target, $quality)) {
            $converted++;
            $messages[] = "✅ Converti : " . basename($file);
            unlink($file);
        } else {
            $errors++;
            $messages[] = "❌ Erreur : " . basename($file);
        }
    }
}
?>

<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
<meta name="robots" content="noindex, nofollow">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>DS.BAT - Gestionnaire d'images</title>
    <style>
        * { margin:0; padding:0; box-sizing:border-box; font-family:Arial, sans-serif; }
        body {
            background: linear-gradient(135deg, #1e3a8a, #0f172a);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .container {
            max-width: 900px;
            width: 100%;
            background: white;
            border-radius: 30px;
            padding: 40px;
            box-shadow: 0 30px 50px rgba(0,0,0,0.3);
        }
        h1 { color: #1e3a8a; margin-bottom: 20px; }
        .upload-area {
            background: #f8fafc;
            border: 3px dashed #cbd5e1;
            border-radius: 20px;
            padding: 40px;
            text-align: center;
            margin: 20px 0;
            cursor: pointer;
        }
        .btn {
            background: #1e3a8a;
            color: white;
            border: none;
            padding: 12px 30px;
            border-radius: 60px;
            font-size: 1rem;
            cursor: pointer;
            margin: 5px;
        }
        .btn:hover { background: #3b82f6; }
        .messages {
            background: #f1f5f9;
            padding: 20px;
            border-radius: 15px;
            margin: 20px 0;
            max-height: 200px;
            overflow-y: auto;
        }
        .success { color: green; }
        .error { color: red; }
        .photo-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(120px,1fr));
            gap: 15px;
            margin: 20px 0;
        }
        .photo-item {
            background: #f8fafc;
            padding: 10px;
            border-radius: 10px;
            text-align: center;
        }
        .photo-item img {
            width: 100%;
            height: 100px;
            object-fit: cover;
            border-radius: 8px;
        }
        .copy-btn {
            background: #1e3a8a;
            color: white;
            border: none;
            padding: 5px 10px;
            border-radius: 5px;
            font-size: 0.7rem;
            margin-top: 5px;
            cursor: pointer;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>📸 Gestionnaire d'images DS.BAT</h1>
        
        <?php if (!empty($messages)): ?>
            <div class="messages">
                <?php foreach ($messages as $msg): ?>
                    <div class="<?= strpos($msg, '✅') !== false ? 'success' : 'error' ?>">
                        <?= $msg ?>
                    </div>
                <?php endforeach; ?>
            </div>
        <?php endif; ?>
        
        <form action="" method="post" enctype="multipart/form-data">
            <div class="upload-area" onclick="document.getElementById('fileInput').click()">
                <p style="font-size:3rem;">📤</p>
                <p>Cliquez ici pour ajouter des photos</p>
                <p style="color:#64748b; font-size:0.9rem;">JPG, PNG acceptés</p>
                <input type="file" name="photos[]" id="fileInput" multiple accept=".jpg,.jpeg,.png" style="display:none;" onchange="this.form.submit()">
            </div>
            
            <div style="text-align:center;">
                <button type="submit" class="btn">📸 Uploader</button>
                <a href="?scan=1" class="btn" style="background:#c59d5f;">📁 Scanner dossier</a>
                <a href="../admin/" class="btn" style="background:#64748b;">← Admin</a>
            </div>
        </form>
        
        <h2 style="margin-top:30px;">📁 Photos disponibles</h2>
        <div class="photo-grid">
            <?php
            $uploads = glob(__DIR__ . '/uploads/*.webp');
            foreach ($uploads as $photo):
                $name = basename($photo);
            ?>
                <div class="photo-item">
                    <img src="uploads/<?= $name ?>" alt="<?= $name ?>">
                    <div style="font-size:0.8rem;"><?= substr($name, 0, 15) ?>...</div>
                    <button class="copy-btn" onclick="copyToClipboard('image/uploads/<?= $name ?>')">📋 Copier</button>
                </div>
            <?php endforeach; ?>
        </div>
    </div>
    
    <script>
        function copyToClipboard(text) {
            navigator.clipboard.writeText(text).then(() => {
                alert('✅ Chemin copié : ' + text);
            });
        }
    </script>
</body>
</html>