pragma solidity ^0.8.10;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import '@openzeppelin/contracts/access/Ownable.sol';

contract GoldBarToken is ERC20, Ownable {
    constructor() ERC20('Gold Bar Token', 'GBC'){}

function mint(address to, uint256 amount) public {
    _mint(to, amount);
}
    
}