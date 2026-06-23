package com.payroll.repository;

import com.payroll.entity.Employee;
import com.payroll.entity.EmployeeStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface EmployeeRepository extends JpaRepository<Employee, UUID> {
    Optional<Employee> findByEmployeeNumber(String employeeNumber);
    boolean existsByEmployeeNumber(String employeeNumber);
    boolean existsByEmail(String email);
    boolean existsByNrc(String nrc);

    Page<Employee> findByStatus(EmployeeStatus status, Pageable pageable);

    @Query("SELECT e FROM Employee e WHERE " +
           "(cast(:search as string) IS NULL " +
           "OR LOWER(e.firstName) LIKE LOWER(CONCAT('%', cast(:search as string), '%')) " +
           "OR LOWER(e.lastName) LIKE LOWER(CONCAT('%', cast(:search as string), '%')) " +
           "OR LOWER(e.employeeNumber) LIKE LOWER(CONCAT('%', cast(:search as string), '%'))) " +
           "AND (:departmentId IS NULL OR e.department.id = :departmentId) " +
           "AND (:status IS NULL OR e.status = :status)")
    Page<Employee> searchEmployees(
            @Param("search") String search,
            @Param("departmentId") UUID departmentId,
            @Param("status") EmployeeStatus status,
            Pageable pageable);

    List<Employee> findByStatus(EmployeeStatus status);

    @Query("SELECT COUNT(e) FROM Employee e WHERE e.status = 'ACTIVE'")
    long countActiveEmployees();

    @Query("SELECT e FROM Employee e WHERE e.status = 'ACTIVE' AND e.id NOT IN " +
           "(SELECT pe.employee.id FROM PayrollEntry pe WHERE pe.payrollRun.id = :payrollRunId) " +
           "AND (:departmentId IS NULL OR e.department.id = :departmentId)")
    List<Employee> findActiveEmployeesNotInPayrollRun(@Param("payrollRunId") UUID payrollRunId,
                                                      @Param("departmentId") UUID departmentId);

    @Query("SELECT d.name AS department, COUNT(e) AS count FROM Employee e JOIN e.department d WHERE e.status = 'ACTIVE' GROUP BY d.name ORDER BY COUNT(e) DESC")
    List<Object[]> countActiveByDepartment();
}
