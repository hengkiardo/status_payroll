pragma solidity ^0.4.11;

import './Ownable.sol';
import './SafeMath.sol';
import './StandardToken.sol';
import './EURToken.sol';

contract Payroll is Ownable {
  using SafeMath for uint256;	 

  uint256 public employeeIds = 1;	 
  uint256 public totalEmployees = 0;

  EURToken public token;

  address public oracle;

  event OracleTransferred(address _oracle, address _newOracle);

  event ReceivedTokens(address _from, uint256 _value, bytes _data);

  struct Employee {
    address account;
    uint256 yearlySalary;
    uint256 id;
    uint256 monthlySalary;
    address[] allowedTokens;
    uint256 lastWithdrawal;
    mapping(address => uint256) allocation;
    mapping(address => bool) salaryTokens;
  }

  mapping(uint256 => Employee) public employees;

  mapping(address => uint256) public addressToId;

  address[] public employeeAccounts;

  mapping(address => uint256) public exchangeRates;

  address[] payrollTokens;

  modifier onlyOracle() {
    require(msg.sender == oracle);
    _;
  }

  modifier onlyEmployee() {
    require(addressToId[msg.sender] > 0);
    _;
  }

  function transferOracle(address newOracle) onlyOwner public {
      require(newOracle != address(0));
      OracleTransferred(oracle, newOracle);
      oracle = newOracle;
  }

  function Payroll(address _oracle, EURToken _token) {
    require(_token.isEURToken());
    oracle = _oracle;
    token = _token;
    payrollTokens.push(token);
  }

  function addEmployee(address accountAddress, address[] allowedTokens, uint256 initialYearlyEURSalary) public onlyOwner {
    uint256 initialMonthlyEURSalary = initialYearlyEURSalary.div(12);
    require(addressToId[accountAddress] == 0);
    employees[employeeIds] = Employee(accountAddress, initialYearlyEURSalary, employeeIds, initialMonthlyEURSalary, allowedTokens, now);
    for (uint256 i = 0; i < allowedTokens.length; i++) {
      employees[employeeIds].salaryTokens[allowedTokens[i]] = true;
    }
    addressToId[accountAddress] = employeeIds;
    employeeAccounts.push(accountAddress);

    employeeIds++;
    totalEmployees++;
  }

  function setEmployeeSalary(uint256 employeeId, uint256 yearlyEURSalary) public onlyOwner {
    //check that it exists first
    employees[employeeId].yearlySalary = yearlyEURSalary;
    uint256 monthlyEURSalary = yearlyEURSalary.div(12);
    employees[employeeId].monthlySalary = monthlyEURSalary;
  }

  function removeEmployee(uint256 employeeId) public onlyOwner {
    require(employees[employeeId].account != 0x0);
    delete addressToId[employees[employeeId].account];
    delete employees[employeeId];
    totalEmployees = totalEmployees.sub(1);
  }

  // Disable sending ETH to this contract
  function() public payable {
    revert();
  }

  function scapeHatch() public onlyOwner {
    for (uint256 i = 0; i < payrollTokens.length; i++) {
      StandardToken payrollToken = StandardToken(payrollTokens[i]);
      payrollToken.transfer(owner, payrollToken.balanceOf(this));
    }
  }

  function tokenFallback(address from, uint256 value, bytes data) public {
    ReceivedTokens(from, value, data);
  }

  function getEmployeeCount() constant public onlyOwner returns (uint256) {
    return totalEmployees;
  }

  function getEmployee(uint256 employeeId) constant returns (address employee) {
    if(employees[employeeId].account != 0x0) {
      return employees[employeeId].account;
    }		  
  }

  function calculatePayrollBurnrate() constant public returns (uint256) {
    uint256 monthlyTotal = 0;
    for(uint256 i = 0; i < employeeAccounts.length; i++) {
      monthlyTotal = monthlyTotal.add(employees[addressToId[employeeAccounts[i]]].monthlySalary);
    }
    return monthlyTotal;
  }

  // Assuming this is looking for EUR runway
  function calculatePayrollRunway() constant public returns (uint256) {
    uint256 eurBalance = token.balanceOf(this);
    uint256 burnrate = calculatePayrollBurnrate();
    uint256 runway = eurBalance.div(burnrate).mul(30);
    return runway;
  }

  function determineAllocation(address[] tokens, uint256[] distribution) public onlyEmployee {
    // Assuming a distribution that adds up to 100
    uint256 distributionTotal = 0;
    for(uint256 i = 0; i < distribution.length; i++) {
      distributionTotal = distributionTotal.add(distribution[i]);
    }
    require(distributionTotal <= 100);

    for (uint256 j = 0; j < tokens.length; j++) {
      require(employees[addressToId[msg.sender]].salaryTokens[tokens[j]]);
      employees[addressToId[msg.sender]].allocation[tokens[j]] = distribution[j];
    }
  }

  // callable every 30 days
  function payday() public onlyEmployee {
    require(now.sub(employees[addressToId[msg.sender]].lastWithdrawal) >= 30 days);		  
    employees[addressToId[msg.sender]].lastWithdrawal = now;

    uint256 id = addressToId[msg.sender];
    uint256 monthlyEUR = employees[id].monthlySalary;
    uint256 precision = 10 ** token.decimals();

    for (uint256 i = 0; i < employees[id].allowedTokens.length; i++) {
    	address localToken = employees[id].allowedTokens[i];
    	uint256 fraction = employees[id].allocation[localToken];
	uint256 EURTokenAmount = monthlyEUR.mul(fraction).div(100);
	// convert this to an amount of new token
	uint256 localTokenAmount = EURTokenAmount.mul(exchangeRates[localToken]).div(precision);
	StandardToken tmpToken = StandardToken(localToken);
	tmpToken.transfer(msg.sender, localTokenAmount);
    }
  }

  function setExchangeRate(address token, uint256 EURExchangeRate) public onlyOracle {
    exchangeRates[token] = EURExchangeRate;
  }

}