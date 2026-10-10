import { Link } from 'react-router-dom';
import logo from '../assets/EVOLVE.png';

export function BrandLogo({ light = false }) {
  return (
    <Link className={`logo${light ? ' logo--light' : ''}`} to="/" aria-label="EVOLVE home">
      <img src={logo} alt="EVOLVE" width="3429" height="393" />
    </Link>
  );
}
