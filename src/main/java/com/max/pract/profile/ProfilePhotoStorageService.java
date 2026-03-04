package com.max.pract.profile;

import com.max.pract.exception.ApiBadRequestException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

@Service
public class ProfilePhotoStorageService {

    private static final Set<String> ALLOWED_EXTENSIONS = Set.of("jpg", "jpeg", "png", "webp", "gif");

    private final Path profilePhotosDir;
    private final long maxPhotoBytes;

    public ProfilePhotoStorageService(
            @Value("${app.uploads.dir:uploads}") String uploadsDir,
            @Value("${app.uploads.max-photo-bytes:5242880}") long maxPhotoBytes
    ) {
        this.profilePhotosDir = Path.of(uploadsDir).toAbsolutePath().normalize().resolve("profile-photos");
        this.maxPhotoBytes = maxPhotoBytes;
        try {
            Files.createDirectories(this.profilePhotosDir);
        } catch (IOException ex) {
            throw new IllegalStateException("Unable to initialize uploads directory", ex);
        }
    }

    public String storeProfilePhoto(Long userId, MultipartFile file, String currentPhotoUrl) {
        validatePhoto(file);
        String extension = resolveExtension(file);
        String fileName = "u" + userId + "_" + UUID.randomUUID().toString().replace("-", "") + "." + extension;
        Path target = profilePhotosDir.resolve(fileName);

        try {
            Files.copy(file.getInputStream(), target, StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException ex) {
            throw new IllegalStateException("Unable to store uploaded file", ex);
        }

        deleteOldPhotoIfManaged(currentPhotoUrl);
        return "/uploads/profile-photos/" + fileName;
    }

    private void validatePhoto(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new ApiBadRequestException("Image file is required");
        }
        String contentType = file.getContentType();
        if (contentType == null || !contentType.toLowerCase(Locale.ROOT).startsWith("image/")) {
            throw new ApiBadRequestException("Only image files are allowed");
        }
        if (file.getSize() > maxPhotoBytes) {
            throw new ApiBadRequestException("Image is too large");
        }
    }

    private String resolveExtension(MultipartFile file) {
        String originalName = file.getOriginalFilename();
        if (originalName == null || !originalName.contains(".")) {
            return "jpg";
        }
        String ext = originalName.substring(originalName.lastIndexOf('.') + 1).trim().toLowerCase(Locale.ROOT);
        if (!ALLOWED_EXTENSIONS.contains(ext)) {
            throw new ApiBadRequestException("Unsupported image extension");
        }
        return ext;
    }

    private void deleteOldPhotoIfManaged(String photoUrl) {
        if (photoUrl == null || photoUrl.isBlank()) {
            return;
        }
        String prefix = "/uploads/profile-photos/";
        if (!photoUrl.startsWith(prefix)) {
            return;
        }
        String fileName = photoUrl.substring(prefix.length());
        Path target = profilePhotosDir.resolve(fileName).normalize();
        if (!target.startsWith(profilePhotosDir)) {
            return;
        }
        try {
            Files.deleteIfExists(target);
        } catch (IOException ignored) {
            // Non-critical cleanup path.
        }
    }
}
