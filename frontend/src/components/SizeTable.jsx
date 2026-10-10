import { sizeMeasurements } from '../data/sizing';
import { useStore } from '../context/StoreContext';

export function SizeTable() {
  const { isArabic } = useStore();
  const headings = isArabic ? ['المقاس', 'الصدر', 'الوسط'] : ['Size', 'Chest', 'Waist'];

  return (
    <table>
      <thead>
        <tr>
          {headings.map((heading) => (
            <th key={heading} scope="col">
              {heading}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {sizeMeasurements.map(({ size, chest, waist }) => (
          <tr key={size}>
            <td>{size}</td>
            <td>{chest}</td>
            <td>{waist}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
