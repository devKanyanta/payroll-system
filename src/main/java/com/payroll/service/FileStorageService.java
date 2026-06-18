package com.payroll.service;

import org.springframework.core.io.Resource;
import org.springframework.web.multipart.MultipartFile;

public interface FileStorageService {
    String storeFile(MultipartFile file, String subdirectory);
    String storeFile(byte[] content, String subdirectory, String filename);
    Resource loadFile(String filePath);
    void deleteFile(String filePath);
}
