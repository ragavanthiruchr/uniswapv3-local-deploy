pragma solidity ^0.8.10;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import '@openzeppelin/contracts/access/Ownable.sol';

contract CopperBarToken is ERC20, Ownable {
    constructor() ERC20('Copper Bar Token', 'CBC'){}
function mint(address to, uint256 amount) public {
    _mint(to, amount);
}
    
}