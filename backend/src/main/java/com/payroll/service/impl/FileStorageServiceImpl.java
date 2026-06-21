package com.payroll.service.impl;

import com.payroll.exception.FileStorageException;
import com.payroll.service.FileStorageService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import jakarta.annotation.PostConstruct;
import java.io.IOException;
import java.net.MalformedURLException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.UUID;

@Service
public class FileStorageServiceImpl implements FileStorageService {

    @Value("${app.payslip-storage:./payslips}")
    private String uploadDir;

    private Path uploadPath;

    @PostConstruct
    public void init() {
        uploadPath = Paths.get(uploadDir).toAbsolutePath().normalize();
        try {
            Files.createDirectories(uploadPath);
        } catch (IOException e) {
            throw new FileStorageException("Could not create upload directory: " + uploadPath, e);
        }
    }

    @Override
    public String storeFile(MultipartFile file, String subdirectory) {
        String originalFilename = file.getOriginalFilename();
        String extension = "";
        if (originalFilename != null && originalFilename.contains(".")) {
            extension = originalFilename.substring(originalFilename.lastIndexOf("."));
        }

        String storedFilename = UUID.randomUUID().toString() + extension;

        Path targetDir = uploadPath.resolve(subdirectory);
        try {
            Files.createDirectories(targetDir);
            Path targetPath = targetDir.resolve(storedFilename);
            Files.copy(file.getInputStream(), targetPath, StandardCopyOption.REPLACE_EXISTING);
            return subdirectory + "/" + storedFilename;
        } catch (IOException e) {
            throw new FileStorageException("Could not store file " + storedFilename, e);
        }
    }

    @Override
    public String storeFile(byte[] content, String subdirectory, String filename) {
        Path targetDir = uploadPath.resolve(subdirectory);
        try {
            Files.createDirectories(targetDir);
            Path targetPath = targetDir.resolve(filename);
            Files.write(targetPath, content);
            return subdirectory + "/" + filename;
        } catch (IOException e) {
            throw new FileStorageException("Could not store file " + filename, e);
        }
    }

    @Override
    public Resource loadFile(String filePath) {
        try {
            Path resolvedPath = uploadPath.resolve(filePath).normalize();
            Resource resource = new UrlResource(resolvedPath.toUri());

            if (resource.exists() && resource.isReadable()) {
                return resource;
            } else {
                throw new FileStorageException("File not found or not readable: " + filePath);
            }
        } catch (MalformedURLException e) {
            throw new FileStorageException("File not found: " + filePath, e);
        }
    }

    @Override
    public void deleteFile(String filePath) {
        try {
            Path resolvedPath = uploadPath.resolve(filePath).normalize();
            Files.deleteIfExists(resolvedPath);
        } catch (IOException e) {
            throw new FileStorageException("Could not delete file: " + filePath, e);
        }
    }
}
